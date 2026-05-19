/**
 * Baselines drizzle's migration tracking against the current DB state.
 *
 * Background: this DB was bootstrapped via `drizzle-kit push`, so the
 * `drizzle.__drizzle_migrations` tracking table was never created and
 * migration 0000 is not marked as applied. Running `drizzle-kit migrate`
 * cold would try to re-apply 0000, which fails (tables already exist).
 *
 * This script:
 *   1. Creates the `drizzle` schema if missing.
 *   2. Creates `drizzle.__drizzle_migrations` if missing.
 *   3. If 0000_bumpy_boomerang is not in the table, inserts a row marking it
 *      as applied — using the SHA-256 of the migration file content (same
 *      formula drizzle-orm's migrator uses) and the `when` timestamp from
 *      `_journal.json`.
 *
 * After this runs once, `drizzle-kit migrate` will see 0000 as applied and
 * advance to 0001.
 */
import postgres from "postgres";
import * as dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✗ DATABASE_URL is missing from .env.local");
  process.exit(1);
}

const journalPath = resolve("drizzle/migrations/meta/_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
  entries: Array<{ idx: number; tag: string; when: number }>;
};

// We only baseline 0000 — 0001 will be applied by drizzle-kit migrate.
const baseline = journal.entries.find((e) => e.tag === "0000_bumpy_boomerang");
if (!baseline) {
  console.error("✗ Could not find 0000_bumpy_boomerang in journal");
  process.exit(1);
}

const sqlPath = resolve(`drizzle/migrations/${baseline.tag}.sql`);
const sqlContent = readFileSync(sqlPath, "utf8");
const hash = createHash("sha256").update(sqlContent).digest("hex");

const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log("→ Baselining drizzle migration tracking");
  console.log(`  target migration: ${baseline!.tag}`);
  console.log(`  computed hash:    ${hash}`);
  console.log(`  created_at:       ${baseline!.when}`);
  console.log("");

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const existing = await sql<{ hash: string; created_at: string }[]>`
    SELECT hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY id ASC
  `;
  console.log(`→ Current __drizzle_migrations rows (${existing.length}):`);
  for (const row of existing) {
    console.log(`  • hash=${row.hash.slice(0, 12)}…  created_at=${row.created_at}`);
  }
  console.log("");

  const alreadyBaselined = existing.some((r) => r.hash === hash);
  if (alreadyBaselined) {
    console.log("✓ Already baselined — no changes made.");
    return;
  }

  if (existing.length > 0) {
    console.error("✗ Migration table has rows, but none match 0000's hash.");
    console.error("  Refusing to insert — manual review needed.");
    process.exit(1);
  }

  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash}, ${baseline!.when})
  `;

  console.log("✓ Inserted baseline row for 0000_bumpy_boomerang.");
  console.log("");
  console.log("Next step: pnpm exec drizzle-kit migrate");
}

main()
  .catch((err) => {
    console.error("✗ Baseline failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end();
  });
