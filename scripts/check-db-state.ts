import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✗ DATABASE_URL is missing from .env.local");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log("→ Inspecting DB state before migration 0001");
  console.log(`  host: ${new URL(connectionString!).host}`);
  console.log(`  db:   ${new URL(connectionString!).pathname.slice(1)}`);
  console.log("");

  // ─── 1. Existing tables ─────────────────────────────────────────────────────
  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log("→ Public tables:");
  for (const t of tables) console.log(`  • ${t.table_name}`);
  console.log("");

  const has = (name: string) => tables.some((t) => t.table_name === name);

  // ─── 2. Critical drift checks ───────────────────────────────────────────────
  const invitesExists = has("invites");
  console.log("→ Drift checks (expected post-migration tables/values):");
  console.log(`  invites table exists:        ${invitesExists ? "YES" : "NO"}`);

  const adminEnum = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'user_role' AND pg_enum.enumlabel = 'admin'
    ) AS exists
  `;
  console.log(`  user_role enum has 'admin':  ${adminEnum[0].exists ? "YES" : "NO"}`);

  const invitesEmailIdx = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'invites_email_idx'
    ) AS exists
  `;
  console.log(`  invites_email_idx exists:    ${invitesEmailIdx[0].exists ? "YES" : "NO"}`);

  // FK on invites.invited_by_id (only meaningful if invites table exists)
  if (invitesExists) {
    const invitesFk = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'invites_invited_by_id_users_id_fk'
      ) AS exists
    `;
    console.log(`  invites FK to users exists:  ${invitesFk[0].exists ? "YES" : "NO"}`);
  }
  console.log("");

  // ─── 3. Current enum values ─────────────────────────────────────────────────
  const userRoleVals = await sql<{ values: string[] }[]>`
    SELECT enum_range(NULL::user_role)::text[] AS values
  `;
  console.log(`→ user_role enum values:     ${userRoleVals[0].values.join(", ")}`);

  const statusVals = await sql<{ values: string[] }[]>`
    SELECT enum_range(NULL::ticket_status)::text[] AS values
  `;
  console.log(`→ ticket_status enum values: ${statusVals[0].values.join(", ")}`);
  console.log("");

  // ─── 4. Ticket-status distribution (we need this for the data migration) ────
  const statusCounts = await sql<{ status: string; count: string }[]>`
    SELECT status::text AS status, COUNT(*)::text AS count
    FROM tickets
    GROUP BY status
    ORDER BY status
  `;
  console.log("→ Ticket counts by current status (this is what 0001 will remap):");
  if (statusCounts.length === 0) {
    console.log("  (no tickets)");
  } else {
    for (const row of statusCounts) {
      console.log(`  • ${row.status.padEnd(15)} ${row.count}`);
    }
  }
  console.log("");

  // ─── 5. Anything from migration 0001 already in place? (sanity) ─────────────
  const newTables = ["sync_logs", "sync_state"];
  const newEnums = ["notion_sync_status", "sync_direction", "sync_entity_type", "sync_result_status"];
  const newColumns: Array<[string, string]> = [
    ["tickets", "deadline_end"],
    ["tickets", "project"],
    ["tickets", "expected_results"],
    ["tickets", "notion_page_id"],
    ["tickets", "notion_last_edited_time"],
    ["tickets", "notion_sync_status"],
  ];

  console.log("→ Pre-existing Notion-sync structures (should all be NO):");
  for (const table of newTables) {
    console.log(`  table ${table.padEnd(12)}        ${has(table) ? "YES (unexpected!)" : "NO"}`);
  }
  for (const enumName of newEnums) {
    const r = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = ${enumName}
      ) AS exists
    `;
    console.log(`  enum  ${enumName.padEnd(20)}  ${r[0].exists ? "YES (unexpected!)" : "NO"}`);
  }
  for (const [table, column] of newColumns) {
    const r = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
      ) AS exists
    `;
    console.log(`  col   ${table}.${column.padEnd(24)} ${r[0].exists ? "YES (unexpected!)" : "NO"}`);
  }
  console.log("");

  console.log("✓ Inspection complete. Paste the full output back to Claude Code.");
}

main()
  .catch((err) => {
    console.error("✗ Inspection failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end();
  });
