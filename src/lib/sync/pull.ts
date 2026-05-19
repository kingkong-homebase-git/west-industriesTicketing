/**
 * Notion → dashboard pull.
 *
 * Runs as a one-shot batch: query Notion for pages edited after our last
 * successful poll, then for each page apply echo-suppression, conflict
 * check (local newer → skip), and finally upsert.
 *
 * Per the prompt's scope cut, we do NOT round-trip checklist or comments
 * on the pull side — those would lose IDs/authorship/timestamps. We DO
 * round-trip the description (extracted from the leading paragraph blocks
 * of the page body, stopping at the first heading_2 which marks the
 * Checklist/Comments sections written by push.ts).
 */

import { db } from "@/db";
import {
  tickets,
  syncState,
  syncLogs,
  type TicketStatus,
} from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  notion,
  NOTION_SYNC_ENABLED,
  getDatabaseSchema,
  getDataSources,
  notionPropertyToTicketFields,
  rateLimitedNotionCall,
} from "@/lib/notion";

export type PullResult = {
  totalPages: number;
  inserted: number;
  updated: number;
  skippedEcho: number;
  skippedConflict: number;
  errors: number;
};

type NotionPage = {
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
  archived?: boolean;
};

const EMPTY_RESULT: PullResult = {
  totalPages: 0,
  inserted: 0,
  updated: 0,
  skippedEcho: 0,
  skippedConflict: 0,
  errors: 0,
};

export async function pullAllFromNotion(): Promise<PullResult> {
  if (!NOTION_SYNC_ENABLED) return { ...EMPTY_RESULT };

  const startedAt = Date.now();
  const result: PullResult = { ...EMPTY_RESULT };
  let success = false;
  let errorMessage: string | null = null;

  try {
    const [state] = await db
      .select()
      .from(syncState)
      .where(eq(syncState.id, 1))
      .limit(1);
    const lastPollAt = state?.lastPollAt ?? null;

    const schema = await getDatabaseSchema();
    const pages = await queryPages(schema.dataSourceId, lastPollAt);
    result.totalPages = pages.length;

    for (const page of pages) {
      try {
        await applyPageToLocal(page, result);
      } catch (err) {
        result.errors += 1;
        await db.insert(syncLogs).values({
          direction: "pull",
          entityType: "ticket",
          notionPageId: page.id,
          status: "failure",
          errorMessage: err instanceof Error ? err.message : String(err),
          durationMs: 0,
        });
      }
    }

    await upsertSyncState({
      lastPollAt: new Date(),
      lastPollStatus: "success",
      lastPollError: null,
    });

    success = true;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    result.errors += 1;
    try {
      await upsertSyncState({
        lastPollAt: undefined,
        lastPollStatus: "failure",
        lastPollError: errorMessage,
      });
    } catch (logErr) {
      console.error("[sync] failed to update sync_state on error:", logErr);
    }
  } finally {
    try {
      await db.insert(syncLogs).values({
        direction: "pull",
        entityType: "ticket",
        status: success ? "success" : "failure",
        errorMessage,
        payload: {
          totalPages: result.totalPages,
          inserted: result.inserted,
          updated: result.updated,
          skippedEcho: result.skippedEcho,
          skippedConflict: result.skippedConflict,
          errors: result.errors,
        },
        durationMs: Date.now() - startedAt,
      });
    } catch (logErr) {
      console.error("[sync] failed to write pull sync_logs row:", logErr);
    }
  }

  return result;
}

async function queryPages(
  dataSourceId: string,
  lastPollAt: Date | null
): Promise<NotionPage[]> {
  const dataSources = getDataSources();
  const filter = lastPollAt
    ? {
        timestamp: "last_edited_time" as const,
        last_edited_time: { on_or_after: lastPollAt.toISOString() },
      }
    : undefined;

  const collected: NotionPage[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response: {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    } = await rateLimitedNotionCall(() =>
      dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        start_cursor: cursor,
        filter,
      })
    );

    collected.push(...response.results);
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return collected;
}

async function applyPageToLocal(
  page: NotionPage,
  result: PullResult
): Promise<void> {
  const fields = notionPropertyToTicketFields(page);

  if (!fields.title) {
    throw new Error(`page_${page.id}_missing_title`);
  }
  if (!fields.status) {
    throw new Error(`page_${page.id}_unknown_status`);
  }

  const [existing] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.notionPageId, page.id))
    .limit(1);

  const description = await fetchDescriptionFromPage(page.id);

  if (!existing) {
    await db.insert(tickets).values({
      title: fields.title,
      description: description || null,
      status: fields.status as TicketStatus,
      project: fields.project,
      expectedResults: fields.expectedResults,
      deadline: fields.deadline,
      deadlineEnd: fields.deadlineEnd,
      notionPageId: page.id,
      notionLastEditedTime: fields.notionLastEditedTime,
      notionSyncStatus: "synced",
    });
    result.inserted += 1;
    await db.insert(syncLogs).values({
      direction: "pull",
      entityType: "ticket",
      notionPageId: page.id,
      status: "success",
      payload: { action: "inserted" },
    });
    return;
  }

  // Echo suppression: Notion's edit time matches (or pre-dates) what we
  // already stored — this is the echo of our own push.
  if (
    existing.notionLastEditedTime &&
    fields.notionLastEditedTime.getTime() <=
      existing.notionLastEditedTime.getTime()
  ) {
    result.skippedEcho += 1;
    return;
  }

  // Conflict: local edit is newer than Notion's edit. Skip and log; our
  // next push will reconcile by overwriting Notion.
  if (existing.updatedAt > fields.notionLastEditedTime) {
    result.skippedConflict += 1;
    await db.insert(syncLogs).values({
      direction: "pull",
      entityType: "ticket",
      entityId: existing.id,
      notionPageId: page.id,
      status: "failure",
      errorMessage: "local_newer_aborting_pull",
    });
    return;
  }

  await db
    .update(tickets)
    .set({
      title: fields.title,
      description: description || null,
      status: fields.status as TicketStatus,
      project: fields.project,
      expectedResults: fields.expectedResults,
      deadline: fields.deadline,
      deadlineEnd: fields.deadlineEnd,
      notionLastEditedTime: fields.notionLastEditedTime,
      notionSyncStatus: "synced",
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, existing.id));

  result.updated += 1;
  await db.insert(syncLogs).values({
    direction: "pull",
    entityType: "ticket",
    entityId: existing.id,
    notionPageId: page.id,
    status: "success",
    payload: { action: "updated" },
  });
}

async function fetchDescriptionFromPage(pageId: string): Promise<string> {
  // We only read paragraph blocks BEFORE the first heading_2 — that delimits
  // the description region. Everything after is the Checklist / Comments
  // section written by push.ts, which we deliberately don't round-trip.
  type Block = {
    type: string;
    paragraph?: { rich_text: Array<{ plain_text?: string }> };
  };
  const response = (await rateLimitedNotionCall(() =>
    notion.blocks.children.list({ block_id: pageId })
  )) as { results: Block[] };

  const paragraphs: string[] = [];
  for (const block of response.results) {
    if (block.type === "heading_2") break;
    if (block.type === "paragraph" && block.paragraph) {
      const text = block.paragraph.rich_text
        .map((r) => r.plain_text ?? "")
        .join("");
      if (text) paragraphs.push(text);
    }
  }
  return paragraphs.join("\n\n");
}

async function upsertSyncState(values: {
  lastPollAt?: Date;
  lastPollStatus: "success" | "failure";
  lastPollError: string | null;
}): Promise<void> {
  // We only stamp last_poll_at on success — failure preserves the previous
  // successful timestamp so the next run still has a starting point.
  const setOnConflict: {
    lastPollStatus: "success" | "failure";
    lastPollError: string | null;
    lastPollAt?: Date;
  } = {
    lastPollStatus: values.lastPollStatus,
    lastPollError: values.lastPollError,
  };
  if (values.lastPollAt !== undefined) {
    setOnConflict.lastPollAt = values.lastPollAt;
  }

  await db
    .insert(syncState)
    .values({
      id: 1,
      lastPollAt: values.lastPollAt ?? null,
      lastPollStatus: values.lastPollStatus,
      lastPollError: values.lastPollError,
    })
    .onConflictDoUpdate({
      target: syncState.id,
      set: setOnConflict,
    });
}
