/**
 * One-time bootstrap: links existing dashboard tickets to existing Notion
 * pages by exact (case-insensitive) title match.
 *
 * Why this script exists: the prod dashboard and the Notion "Key Initiatives"
 * database both already have rows. None are linked (every ticket has
 * notion_page_id = null). If we let the sync run cold, every local edit
 * push-creates a duplicate Notion page, and every Notion poll insert-creates
 * a duplicate local ticket.
 *
 * Default run = DRY RUN. Reports what it would do.
 * Pass --apply to actually write notion_page_id and notion_last_edited_time
 * onto local tickets.
 *
 * Title-only matching is intentionally simple. After running, manually
 * resolve any remaining (unmatched local, unmatched Notion) pairs by
 * editing one side's title to match the other, or by deleting one.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";
import { Client } from "@notionhq/client";

const DRY_RUN = !process.argv.includes("--apply");

const dbUrl = process.env.DATABASE_URL;
const notionToken = process.env.NOTION_TOKEN;
const notionDatabaseId = process.env.NOTION_DATABASE_ID;
if (!dbUrl || !notionToken || !notionDatabaseId) {
  console.error(
    "✗ Missing env: need DATABASE_URL, NOTION_TOKEN, NOTION_DATABASE_ID"
  );
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });
const notion = new Client({ auth: notionToken });

type LocalTicket = {
  id: string;
  title: string;
  notion_page_id: string | null;
  status: string;
};

type NotionRow = {
  id: string;
  last_edited_time: string;
  title: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function plainText(rich: Array<{ plain_text?: string }> | undefined): string {
  return (rich ?? []).map((r) => r.plain_text ?? "").join("");
}

async function fetchLocalTickets(): Promise<LocalTicket[]> {
  return await sql<LocalTicket[]>`
    SELECT id, title, notion_page_id, status::text AS status
    FROM tickets
    ORDER BY created_at ASC
  `;
}

async function fetchNotionPages(): Promise<NotionRow[]> {
  // Resolve database → primary data source.
  const db = (await notion.databases.retrieve({
    database_id: notionDatabaseId!,
  })) as { data_sources?: Array<{ id: string }> };
  const ds = db.data_sources?.[0];
  if (!ds) throw new Error("Database has no data sources");

  const collected: NotionRow[] = [];
  let cursor: string | undefined = undefined;
  do {
    const response: {
      results: Array<{
        id: string;
        last_edited_time: string;
        properties: Record<string, unknown>;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    } = await (
      notion as unknown as {
        dataSources: {
          query: (a: {
            data_source_id: string;
            page_size: number;
            start_cursor?: string;
          }) => Promise<{
            results: Array<{
              id: string;
              last_edited_time: string;
              properties: Record<string, unknown>;
            }>;
            has_more: boolean;
            next_cursor: string | null;
          }>;
        };
      }
    ).dataSources.query({
      data_source_id: ds.id,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const page of response.results) {
      const titleProp = page.properties["Name"] as
        | { type: "title"; title: Array<{ plain_text?: string }> }
        | undefined;
      const title =
        titleProp?.type === "title" ? plainText(titleProp.title) : "";
      collected.push({
        id: page.id,
        last_edited_time: page.last_edited_time,
        title,
      });
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return collected;
}

async function main() {
  console.log(`→ Bootstrap linkage (${DRY_RUN ? "DRY RUN" : "APPLY"})`);
  console.log("");

  const [tickets, pages] = await Promise.all([
    fetchLocalTickets(),
    fetchNotionPages(),
  ]);

  console.log(`  Local tickets: ${tickets.length}`);
  console.log(`  Notion pages:  ${pages.length}`);
  console.log("");

  const alreadyLinked = tickets.filter((t) => t.notion_page_id !== null);
  if (alreadyLinked.length > 0) {
    console.log(`→ Already linked (${alreadyLinked.length}):`);
    for (const t of alreadyLinked) {
      console.log(`  • [${t.id.slice(0, 8)}] "${t.title}" → ${t.notion_page_id?.slice(0, 12)}`);
    }
    console.log("");
  }

  const unlinkedTickets = tickets.filter((t) => t.notion_page_id === null);
  const claimedPageIds = new Set(
    tickets.filter((t) => t.notion_page_id).map((t) => t.notion_page_id!)
  );

  // Index Notion pages by normalized title for fast lookup. Note: titles
  // can collide. We handle that by reporting ambiguities and refusing to link.
  const notionByTitle = new Map<string, NotionRow[]>();
  for (const p of pages) {
    if (claimedPageIds.has(p.id)) continue;
    const key = normalize(p.title);
    const list = notionByTitle.get(key) ?? [];
    list.push(p);
    notionByTitle.set(key, list);
  }

  const matches: Array<{ ticket: LocalTicket; page: NotionRow }> = [];
  const ambiguous: Array<{ ticket: LocalTicket; candidates: NotionRow[] }> = [];
  const unmatchedTickets: LocalTicket[] = [];

  for (const t of unlinkedTickets) {
    const key = normalize(t.title);
    const candidates = notionByTitle.get(key);
    if (!candidates || candidates.length === 0) {
      unmatchedTickets.push(t);
    } else if (candidates.length === 1) {
      matches.push({ ticket: t, page: candidates[0] });
    } else {
      ambiguous.push({ ticket: t, candidates });
    }
  }

  // Notion pages that nothing matched.
  const usedPageIds = new Set(matches.map((m) => m.page.id));
  const unmatchedNotion = pages.filter(
    (p) => !claimedPageIds.has(p.id) && !usedPageIds.has(p.id)
  );

  console.log(`→ Proposed matches (${matches.length}):`);
  for (const m of matches) {
    console.log(
      `  ✓ [${m.ticket.id.slice(0, 8)}] "${m.ticket.title}"  ↔  ` +
        `[${m.page.id.slice(0, 12)}] "${m.page.title}"`
    );
  }
  console.log("");

  if (ambiguous.length > 0) {
    console.log(`⚠ Ambiguous (multiple Notion pages share this title; SKIPPED):`);
    for (const a of ambiguous) {
      console.log(`  [${a.ticket.id.slice(0, 8)}] "${a.ticket.title}":`);
      for (const c of a.candidates) {
        console.log(`     candidate: [${c.id.slice(0, 12)}] "${c.title}"`);
      }
    }
    console.log("");
  }

  if (unmatchedTickets.length > 0) {
    console.log(
      `⚠ Local tickets with NO Notion match (${unmatchedTickets.length}):`
    );
    console.log("  These will be push-created as new Notion pages on next edit.");
    for (const t of unmatchedTickets) {
      console.log(`  • [${t.id.slice(0, 8)}] "${t.title}" (${t.status})`);
    }
    console.log("");
  }

  if (unmatchedNotion.length > 0) {
    console.log(`⚠ Notion pages with NO local match (${unmatchedNotion.length}):`);
    console.log("  These will be pull-inserted as new local tickets on next poll.");
    for (const p of unmatchedNotion) {
      console.log(`  • [${p.id.slice(0, 12)}] "${p.title}"`);
    }
    console.log("");
  }

  if (DRY_RUN) {
    console.log("✓ Dry run complete — no changes written.");
    console.log("");
    console.log("To apply the proposed matches:");
    console.log("  pnpm exec tsx scripts/bootstrap-notion-linkage.ts --apply");
    await sql.end();
    return;
  }

  console.log(`→ Applying ${matches.length} link(s)…`);
  for (const m of matches) {
    await sql`
      UPDATE tickets
      SET notion_page_id = ${m.page.id},
          notion_last_edited_time = ${m.page.last_edited_time}::timestamptz,
          notion_sync_status = 'synced'
      WHERE id = ${m.ticket.id}
    `;
    console.log(`  ✓ linked [${m.ticket.id.slice(0, 8)}] → ${m.page.id.slice(0, 12)}`);
  }
  console.log("");
  console.log("✓ Apply complete.");
  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Bootstrap failed:", err);
  await sql.end();
  process.exit(1);
});
