/**
 * One-time: deletes all local tickets and pulls fresh from Notion.
 * Used for the Notion-as-source-of-truth bootstrap.
 *
 * Refuses to run if the local ticket count is > 50, on the assumption
 * that anything that big is real data, not test data. Override with
 * --force if you really mean it.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";

const FORCE = process.argv.includes("--force");
const MAX_DELETE_WITHOUT_FORCE = 50;

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("✗ DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

async function main() {
  // 1. Count local tickets first.
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM tickets
  `;
  console.log(`→ Local ticket count: ${count}`);

  if (count > MAX_DELETE_WITHOUT_FORCE && !FORCE) {
    console.error(
      `✗ Refusing to delete ${count} tickets without --force. Bail.`
    );
    await sql.end();
    process.exit(1);
  }

  // 2. Show what we'd delete.
  const tickets = await sql<{ id: string; title: string; status: string }[]>`
    SELECT id, title, status::text AS status
    FROM tickets
    ORDER BY created_at ASC
  `;
  console.log("→ Will delete:");
  for (const t of tickets) {
    console.log(`  • [${t.id.slice(0, 8)}] "${t.title}" (${t.status})`);
  }
  console.log("");

  // 3. Delete (checklist_items / comments / sync_logs cascade or set null).
  const result = await sql`DELETE FROM tickets RETURNING id`;
  console.log(`✓ Deleted ${result.length} tickets`);
  console.log("");

  await sql.end();

  // 4. Run a pull. Dynamic import so dotenv runs first.
  console.log("→ Running pullAllFromNotion()…");
  const { pullAllFromNotion } = await import("../src/lib/sync/pull");
  const pullResult = await pullAllFromNotion();
  console.log("");
  console.log("→ Pull result:");
  console.log(`  totalPages:      ${pullResult.totalPages}`);
  console.log(`  inserted:        ${pullResult.inserted}`);
  console.log(`  updated:         ${pullResult.updated}`);
  console.log(`  skippedEcho:     ${pullResult.skippedEcho}`);
  console.log(`  skippedConflict: ${pullResult.skippedConflict}`);
  console.log(`  errors:          ${pullResult.errors}`);
  console.log("");

  // 5. Spot check: list what landed.
  const sql2 = postgres(dbUrl!, { max: 1 });
  const landed = await sql2<
    { id: string; title: string; status: string; notion_page_id: string | null }[]
  >`
    SELECT id, title, status::text AS status, notion_page_id
    FROM tickets
    ORDER BY title ASC
  `;
  console.log(`→ Local tickets after pull (${landed.length}):`);
  for (const t of landed) {
    const linked = t.notion_page_id ? "✓ linked" : "✗ unlinked";
    console.log(
      `  • [${t.id.slice(0, 8)}] "${t.title}" (${t.status}) ${linked}`
    );
  }
  console.log("");

  // 6. Sync log tail.
  const recentLogs = await sql2<
    { direction: string; status: string; error_message: string | null }[]
  >`
    SELECT direction::text AS direction, status::text AS status, error_message
    FROM sync_logs
    ORDER BY created_at DESC
    LIMIT 15
  `;
  console.log("→ Recent sync_logs (most recent first):");
  for (const r of recentLogs) {
    const err = r.error_message ? ` — ${r.error_message}` : "";
    console.log(`  ${r.direction.padEnd(5)} ${r.status}${err}`);
  }

  await sql2.end();
  console.log("");
  console.log("✓ Done.");
}

main().catch(async (err) => {
  console.error("✗ Failed:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
