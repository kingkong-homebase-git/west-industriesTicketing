import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const tickets = await sql<{
    id: string;
    title: string;
    status: string;
    notion_page_id: string | null;
    notion_sync_status: string;
  }[]>`
    SELECT id, title, status::text AS status,
           notion_page_id, notion_sync_status::text AS notion_sync_status
    FROM tickets
    ORDER BY created_at ASC
  `;
  console.log(`Tickets (${tickets.length}):`);
  for (const t of tickets) {
    const linked = t.notion_page_id ? `→ ${t.notion_page_id.slice(0, 12)}` : "(unlinked)";
    console.log(`  • [${t.id.slice(0, 8)}] "${t.title}" [${t.status}/${t.notion_sync_status}] ${linked}`);
  }
  console.log("");

  const logs = await sql<{
    direction: string;
    entity_id: string | null;
    notion_page_id: string | null;
    status: string;
    error_message: string | null;
    payload: unknown;
    created_at: Date;
  }[]>`
    SELECT direction::text AS direction, entity_id,
           notion_page_id, status::text AS status, error_message,
           payload, created_at
    FROM sync_logs
    ORDER BY created_at DESC
    LIMIT 20
  `;
  console.log(`Recent sync_logs (${logs.length}):`);
  for (const l of logs) {
    const where = l.entity_id?.slice(0, 8) ?? l.notion_page_id?.slice(0, 12) ?? "-";
    const err = l.error_message ? ` — ${l.error_message}` : "";
    const payload = l.payload ? ` ${JSON.stringify(l.payload)}` : "";
    console.log(`  ${l.direction.padEnd(5)} ${l.status.padEnd(7)} ${where.padEnd(13)}${err}${payload}`);
  }
  console.log("");

  const state = await sql<{
    last_poll_at: Date | null;
    last_poll_status: string | null;
    last_poll_error: string | null;
  }[]>`SELECT last_poll_at, last_poll_status::text AS last_poll_status, last_poll_error FROM sync_state WHERE id = 1`;
  console.log(`sync_state:`, state[0] ?? "(empty)");

  await sql.end();
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
