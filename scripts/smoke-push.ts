/**
 * End-to-end push smoke test (reversible).
 *
 * Picks the first ticket alphabetically, modifies its description to include
 * a unique marker, runs the production push code path, retrieves the page
 * from Notion to verify the change landed, then restores the original
 * description and pushes again. Reports the sync_logs entries it wrote.
 *
 * Safe to run repeatedly. Side effect on Notion is identical pre- and
 * post-run (one transient marker visible during the test).
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";
import { Client } from "@notionhq/client";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const notion = new Client({ auth: process.env.NOTION_TOKEN! });

const MARKER = `[smoke-test-${Date.now()}]`;

async function fetchNotionParagraphText(pageId: string): Promise<string> {
  const response = (await notion.blocks.children.list({
    block_id: pageId,
  })) as {
    results: Array<{
      type: string;
      paragraph?: { rich_text: Array<{ plain_text?: string }> };
    }>;
  };
  const paragraphs: string[] = [];
  for (const block of response.results) {
    if (block.type === "heading_2") break;
    if (block.type === "paragraph" && block.paragraph) {
      paragraphs.push(
        block.paragraph.rich_text.map((r) => r.plain_text ?? "").join("")
      );
    }
  }
  return paragraphs.join("\n\n");
}

async function main() {
  console.log(`→ Smoke push test (marker: ${MARKER})`);
  console.log("");

  const [ticket] = await sql<
    {
      id: string;
      title: string;
      description: string | null;
      notion_page_id: string | null;
    }[]
  >`
    SELECT id, title, description, notion_page_id
    FROM tickets
    WHERE notion_page_id IS NOT NULL
    ORDER BY title ASC
    LIMIT 1
  `;

  if (!ticket) {
    console.error("✗ No tickets with notion_page_id — run wipe-and-pull first");
    await sql.end();
    process.exit(1);
  }
  console.log(
    `→ Target: [${ticket.id.slice(0, 8)}] "${ticket.title}" → ${ticket.notion_page_id?.slice(0, 12)}`
  );
  console.log("");

  const originalDesc = ticket.description ?? "";
  const markedDesc = (originalDesc ? originalDesc + "\n\n" : "") + MARKER;

  // ─── STEP 1: write marker locally + push ──────────────────────────────────
  console.log("→ Step 1: write marked description + push");
  await sql`
    UPDATE tickets
    SET description = ${markedDesc}, updated_at = NOW()
    WHERE id = ${ticket.id}
  `;
  await sql.end();

  // Dynamic import so the previous sql.end() releases before push.ts opens its own.
  const { pushTicketToNotion } = await import("../src/lib/sync/push");
  await pushTicketToNotion(ticket.id);
  console.log("  ✓ push complete");
  console.log("");

  // ─── STEP 2: verify Notion has the marker ─────────────────────────────────
  console.log("→ Step 2: read back from Notion");
  const notionText = await fetchNotionParagraphText(ticket.notion_page_id!);
  const hasMarker = notionText.includes(MARKER);
  console.log(`  marker present in Notion: ${hasMarker ? "✓ YES" : "✗ NO"}`);
  console.log(`  notion description content (truncated):`);
  console.log(`    ${notionText.slice(0, 200)}${notionText.length > 200 ? "…" : ""}`);
  console.log("");

  if (!hasMarker) {
    console.error("✗ Marker missing from Notion — push appears to have failed");
    process.exit(1);
  }

  // ─── STEP 3: restore + push again ─────────────────────────────────────────
  console.log("→ Step 3: restore original description + push");
  const sql2 = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql2`
    UPDATE tickets
    SET description = ${originalDesc || null}, updated_at = NOW()
    WHERE id = ${ticket.id}
  `;
  await sql2.end();
  await pushTicketToNotion(ticket.id);
  console.log("  ✓ push complete");
  console.log("");

  // ─── STEP 4: verify marker gone ───────────────────────────────────────────
  console.log("→ Step 4: verify marker removed from Notion");
  const notionTextFinal = await fetchNotionParagraphText(ticket.notion_page_id!);
  const stillHasMarker = notionTextFinal.includes(MARKER);
  console.log(`  marker present after restore: ${stillHasMarker ? "✗ STILL THERE" : "✓ gone"}`);
  console.log("");

  // ─── STEP 5: dump the new sync_logs rows ──────────────────────────────────
  console.log("→ Step 5: recent sync_logs for this ticket");
  const sql3 = postgres(process.env.DATABASE_URL!, { max: 1 });
  const logs = await sql3<
    {
      direction: string;
      status: string;
      error_message: string | null;
      duration_ms: number | null;
      created_at: Date;
    }[]
  >`
    SELECT direction::text AS direction, status::text AS status,
           error_message, duration_ms, created_at
    FROM sync_logs
    WHERE entity_id = ${ticket.id}
    ORDER BY created_at DESC
    LIMIT 5
  `;
  for (const l of logs) {
    const err = l.error_message ? ` — ${l.error_message}` : "";
    console.log(
      `  ${l.created_at.toISOString()} ${l.direction.padEnd(5)} ${l.status.padEnd(7)} ${l.duration_ms}ms${err}`
    );
  }

  await sql3.end();
  console.log("");
  console.log("✓ End-to-end smoke test complete.");
}

main().catch(async (err) => {
  console.error("✗ Smoke test failed:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
