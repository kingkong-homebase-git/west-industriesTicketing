/**
 * Dashboard → Notion push.
 *
 * pushTicketToNotion(ticketId) is idempotent and always writes one sync_logs
 * row (success or failure). On conflict (Notion's last_edited_time newer than
 * our stored notion_last_edited_time) we abort and rely on the next pull to
 * reconcile — the alternative (enqueue an immediate pull) introduces a
 * circular dependency between push.ts and pull.ts; the 5-minute poll window
 * is a small price.
 */

import { db } from "@/db";
import {
  tickets,
  checklistItems,
  comments,
  users,
  syncLogs,
  type TicketStatus,
} from "../../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import {
  notion,
  NOTION_DATABASE_ID,
  NOTION_SYNC_ENABLED,
  rateLimitedNotionCall,
  ticketFieldsToNotionProperties,
} from "@/lib/notion";
import { buildPageBlocks, isManagedMarkerBlock } from "./body";

type NotionPageResponse = {
  id: string;
  last_edited_time: string;
};

const NOTION_BLOCK_APPEND_LIMIT = 100;

export async function pushTicketToNotion(ticketId: string): Promise<void> {
  if (!NOTION_SYNC_ENABLED) return;

  const startedAt = Date.now();
  let pageId: string | null = null;
  let success = false;
  let errorMessage: string | null = null;
  let logPayload: Record<string, unknown> | null = null;

  try {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

    pageId = ticket.notionPageId;

    // Conflict check: only meaningful for updates.
    if (pageId && ticket.notionLastEditedTime) {
      const current = (await rateLimitedNotionCall(() =>
        notion.pages.retrieve({ page_id: pageId! })
      )) as NotionPageResponse;
      const remoteEdited = new Date(current.last_edited_time);
      if (remoteEdited > ticket.notionLastEditedTime) {
        errorMessage = "notion_newer_aborting_push";
        throw new Error(errorMessage);
      }
    }

    const properties = ticketFieldsToNotionProperties({
      title: ticket.title,
      status: ticket.status as TicketStatus,
      project: ticket.project,
      expectedResults: ticket.expectedResults,
      deadline: ticket.deadline,
      deadlineEnd: ticket.deadlineEnd,
    });

    logPayload = { properties };

    // Create or update the page.
    if (!pageId) {
      const created = (await rateLimitedNotionCall(() =>
        notion.pages.create({
          parent: { database_id: NOTION_DATABASE_ID },
          properties: properties as Parameters<
            typeof notion.pages.create
          >[0]["properties"],
        })
      )) as NotionPageResponse;
      pageId = created.id;
    } else {
      await rateLimitedNotionCall(() =>
        notion.pages.update({
          page_id: pageId!,
          properties: properties as Parameters<
            typeof notion.pages.update
          >[0]["properties"],
        })
      );
    }

    // Build & replace page body (description + checklist + comments).
    const [checklist, ticketComments] = await Promise.all([
      db
        .select()
        .from(checklistItems)
        .where(eq(checklistItems.ticketId, ticketId))
        .orderBy(asc(checklistItems.sortOrder)),
      db
        .select({
          body: comments.body,
          createdAt: comments.createdAt,
          authorName: users.name,
        })
        .from(comments)
        .leftJoin(users, eq(comments.authorId, users.id))
        .where(eq(comments.ticketId, ticketId))
        .orderBy(asc(comments.createdAt)),
    ]);

    const blocks = buildPageBlocks({
      description: ticket.description,
      checklist: checklist.map((c) => ({ label: c.label, isDone: c.isDone })),
      comments: ticketComments.map((c) => ({
        body: c.body,
        createdAt: c.createdAt,
        authorName: c.authorName ?? "Deleted user",
      })),
    });

    await replacePageBody(pageId, blocks);

    // Pull the final last_edited_time so the next conflict check is grounded.
    const finalPage = (await rateLimitedNotionCall(() =>
      notion.pages.retrieve({ page_id: pageId! })
    )) as NotionPageResponse;

    await db
      .update(tickets)
      .set({
        notionPageId: pageId,
        notionLastEditedTime: new Date(finalPage.last_edited_time),
        notionSyncStatus: "synced",
      })
      .where(eq(tickets.id, ticketId));

    success = true;
  } catch (err) {
    if (!errorMessage) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    await db
      .update(tickets)
      .set({ notionSyncStatus: "failed" })
      .where(eq(tickets.id, ticketId));
  } finally {
    try {
      await db.insert(syncLogs).values({
        direction: "push",
        entityType: "ticket",
        entityId: ticketId,
        notionPageId: pageId,
        status: success ? "success" : "failure",
        errorMessage,
        payload: logPayload,
        durationMs: Date.now() - startedAt,
      });
    } catch (logErr) {
      // If we can't even log, surface to the console — don't mask the
      // primary outcome by throwing here.
      console.error("[sync] failed to write sync_logs row:", logErr);
    }
  }
}

/**
 * Archive (soft-delete) a Notion page. Used when a dashboard ticket is
 * deleted. The ticket row is gone by the time we call this, so the caller
 * must pass the notion_page_id explicitly.
 */
export async function archiveNotionPage(
  notionPageId: string,
  ticketIdForLog: string | null
): Promise<void> {
  if (!NOTION_SYNC_ENABLED) return;

  const startedAt = Date.now();
  let success = false;
  let errorMessage: string | null = null;

  try {
    await rateLimitedNotionCall(() =>
      notion.pages.update({ page_id: notionPageId, archived: true })
    );
    success = true;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    try {
      await db.insert(syncLogs).values({
        direction: "push",
        entityType: "ticket",
        entityId: ticketIdForLog,
        notionPageId,
        status: success ? "success" : "failure",
        errorMessage,
        payload: { archived: true },
        durationMs: Date.now() - startedAt,
      });
    } catch (logErr) {
      console.error("[sync] failed to write sync_logs row:", logErr);
    }
  }
}

async function replacePageBody(
  pageId: string,
  blocks: Array<Record<string, unknown>>
): Promise<void> {
  // Notion has no "set children" call. We only manage the region from our
  // sentinel marker downward: list children, find the marker, and delete from
  // there to the end. Anything ABOVE the marker is human-authored and is left
  // untouched. If no marker is found (a page with pre-existing content we've
  // never synced), we delete nothing and simply append our section at the end —
  // so a first push never destroys existing body content. `blocks` already
  // begins with the marker (see buildPageBlocks).
  const existing = (await rateLimitedNotionCall(() =>
    notion.blocks.children.list({ block_id: pageId })
  )) as { results: Array<{ id: string } & Record<string, unknown>> };

  const markerIndex = existing.results.findIndex(isManagedMarkerBlock);
  const toDelete =
    markerIndex === -1 ? [] : existing.results.slice(markerIndex);

  for (const block of toDelete) {
    await rateLimitedNotionCall(() =>
      notion.blocks.delete({ block_id: block.id })
    );
  }

  for (let i = 0; i < blocks.length; i += NOTION_BLOCK_APPEND_LIMIT) {
    const chunk = blocks.slice(i, i + NOTION_BLOCK_APPEND_LIMIT);
    await rateLimitedNotionCall(() =>
      notion.blocks.children.append({
        block_id: pageId,
        children: chunk as Parameters<
          typeof notion.blocks.children.append
        >[0]["children"],
      })
    );
  }
}
