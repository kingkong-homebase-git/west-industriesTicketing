/**
 * One-shot reconciliation for the managed-section marker (A.9).
 *
 * Pages linked before A.9 carry our Description/Checklist/Comments body with NO
 * marker. Under the new push logic those pages would get a duplicate markered
 * section appended on their next push. This script fixes them once: for each
 * linked ticket it wipes the page body and rebuilds it from the DB with the
 * marker in place, so future pushes manage the section cleanly.
 *
 * Idempotent: a page that already contains the marker is skipped.
 *
 * SAFETY: a full body wipe destroys ANY block on the page, including notes a
 * human typed. Run WITHOUT --apply first — the dry run prints every block type
 * on every page so you can confirm none of them are human content before you
 * commit to the wipe. Re-run with --apply only once you're satisfied.
 *
 *   pnpm tsx scripts/reconcile-notion-bodies.ts            # dry run (default)
 *   pnpm tsx scripts/reconcile-notion-bodies.ts --apply    # perform the wipe
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";
import { Client } from "@notionhq/client";
import { buildPageBlocks, isManagedMarkerBlock } from "../src/lib/sync/body";

const APPLY = process.argv.includes("--apply");
const NOTION_BLOCK_APPEND_LIMIT = 100;

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const notion = new Client({ auth: process.env.NOTION_TOKEN! });

// Gentle pacing so a burst of delete/append calls doesn't trip Notion's 429s.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ListedBlock = { id: string; type: string } & Record<string, unknown>;

async function listAllChildren(pageId: string): Promise<ListedBlock[]> {
  const all: ListedBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = (await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
    })) as {
      results: ListedBlock[];
      has_more: boolean;
      next_cursor: string | null;
    };
    all.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    await sleep(120);
  } while (cursor);
  return all;
}

async function main() {
  console.log(
    `→ Notion body reconciliation (${APPLY ? "APPLY — will mutate" : "DRY RUN — no changes"})\n`
  );

  const linked = await sql<
    { id: string; title: string; notion_page_id: string }[]
  >`
    SELECT id, title, notion_page_id
    FROM tickets
    WHERE notion_page_id IS NOT NULL
    ORDER BY title ASC
  `;

  console.log(`→ ${linked.length} linked ticket(s) found\n`);

  let skipped = 0;
  let reconciled = 0;

  for (const ticket of linked) {
    const tag = `[${ticket.id.slice(0, 8)}] "${ticket.title}"`;
    const existing = await listAllChildren(ticket.notion_page_id);
    const hasMarker = existing.some(isManagedMarkerBlock);

    if (hasMarker) {
      console.log(`  ⏭  ${tag} — already has marker, skipping`);
      skipped++;
      continue;
    }

    const blockTypes = existing.map((b) => b.type).join(", ") || "(empty)";
    console.log(`  • ${tag}`);
    console.log(`      ${existing.length} existing block(s): ${blockTypes}`);

    if (!APPLY) {
      console.log(`      would wipe all ${existing.length} block(s) + rebuild with marker`);
      continue;
    }

    // Pull the body source data from the DB.
    const [checklist, ticketComments] = await Promise.all([
      sql<{ label: string; is_done: boolean }[]>`
        SELECT label, is_done FROM checklist_items
        WHERE ticket_id = ${ticket.id} ORDER BY sort_order ASC
      `,
      sql<{ body: string; created_at: Date; author_name: string | null }[]>`
        SELECT c.body, c.created_at, u.name AS author_name
        FROM comments c
        LEFT JOIN users u ON u.id = c.author_id
        WHERE c.ticket_id = ${ticket.id} ORDER BY c.created_at ASC
      `,
    ]);

    const [descRow] = await sql<{ description: string | null }[]>`
      SELECT description FROM tickets WHERE id = ${ticket.id}
    `;

    const blocks = buildPageBlocks({
      description: descRow?.description ?? null,
      checklist: checklist.map((c) => ({ label: c.label, isDone: c.is_done })),
      comments: ticketComments.map((c) => ({
        body: c.body,
        createdAt: c.created_at,
        authorName: c.author_name ?? "Deleted user",
      })),
    });

    // Wipe every existing block, then append the rebuilt (markered) body.
    for (const block of existing) {
      await notion.blocks.delete({ block_id: block.id });
      await sleep(120);
    }
    for (let i = 0; i < blocks.length; i += NOTION_BLOCK_APPEND_LIMIT) {
      const chunk = blocks.slice(i, i + NOTION_BLOCK_APPEND_LIMIT);
      await notion.blocks.children.append({
        block_id: ticket.notion_page_id,
        children: chunk as Parameters<
          typeof notion.blocks.children.append
        >[0]["children"],
      });
      await sleep(120);
    }

    // Re-ground the conflict baseline so the next real push doesn't see the
    // page as "newer" and abort.
    const finalPage = (await notion.pages.retrieve({
      page_id: ticket.notion_page_id,
    })) as { last_edited_time: string };
    await sql`
      UPDATE tickets
      SET notion_last_edited_time = ${finalPage.last_edited_time},
          notion_sync_status = 'synced'
      WHERE id = ${ticket.id}
    `;

    console.log(`      ✓ wiped + rebuilt with marker`);
    reconciled++;
  }

  console.log(
    `\n→ Done. ${reconciled} reconciled, ${skipped} already-markered (skipped).`
  );
  if (!APPLY && reconciled === 0 && skipped < linked.length) {
    console.log("  Re-run with --apply to perform the wipe + rebuild.");
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Reconciliation failed:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
