/**
 * ⚠️ DANGER — DO NOT RUN --apply WITHOUT READING THIS. ⚠️
 *
 * This was written to de-duplicate pages that held our OLD machine-generated
 * body (paragraph / "Checklist" / "Comments") before the A.9 marker existed.
 * On 2026-05-20 the dry run revealed the linked pages instead contain rich,
 * human-authored template content (multi-level headings, callouts, bulleted
 * lists — 26+ blocks each). A full wipe would DESTROY that content.
 *
 * It turns out NO reconciliation is needed: A.9's push already preserves these
 * pages. When push finds no marker it deletes nothing and appends our managed
 * section below the existing content (see replacePageBody in src/lib/sync/push.ts).
 *
 * This script is retained only for the narrow case it was designed for — pages
 * whose body is purely our own machine output (or empty). The guard below
 * REFUSES to wipe any page containing block types our code never generates, so
 * an accidental --apply cannot delete human content. Leave it that way.
 *
 *   pnpm exec tsx scripts/reconcile-notion-bodies.ts            # dry run (default)
 *   pnpm exec tsx scripts/reconcile-notion-bodies.ts --apply    # guarded wipe
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";
import { Client } from "@notionhq/client";
import { buildPageBlocks, isManagedMarkerBlock } from "../src/lib/sync/body";

const APPLY = process.argv.includes("--apply");
const NOTION_BLOCK_APPEND_LIMIT = 100;

// The only block types our own body generator (buildPageBlocks) ever emits,
// minus the marker callout. A page whose blocks are all within this set (or
// empty) is safe to rebuild; anything else means a human authored it and we
// must NOT wipe it.
const MACHINE_BLOCK_TYPES = new Set(["paragraph", "heading_2", "to_do"]);

function looksHumanAuthored(blocks: { type: string }[]): boolean {
  return blocks.some((b) => !MACHINE_BLOCK_TYPES.has(b.type));
}

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
  let protectedHuman = 0;

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

    // Hard guard: never wipe a page that contains block types our generator
    // doesn't emit — those are human-authored. This makes an accidental
    // --apply non-destructive.
    if (looksHumanAuthored(existing)) {
      console.log(
        `      🛑 contains non-machine blocks (human content) — REFUSING to wipe, skipping`
      );
      protectedHuman++;
      continue;
    }

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
    `\n→ Done. ${reconciled} reconciled, ${skipped} already-markered, ` +
      `${protectedHuman} protected (human content, not touched).`
  );
  if (protectedHuman > 0) {
    console.log(
      "  Protected pages keep their content; A.9's push appends our managed " +
        "section below it on next sync — no reconciliation needed."
    );
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Reconciliation failed:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
