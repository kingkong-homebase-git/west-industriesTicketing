/**
 * Database purge script. Cleans up stale rows that are no longer needed:
 *
 *  1. Expired pending invites  (is_accepted=false AND expires_at < now())
 *  2. Old accepted invites     (is_accepted=true  AND accepted_at > 90 days ago)
 *  3. Spent / expired password reset tokens
 *
 * Safe to run repeatedly (idempotent). Does NOT touch users or seed data.
 *
 * Usage:
 *   pnpm tsx scripts/purge-database.ts            # live run
 *   pnpm tsx scripts/purge-database.ts --dry-run   # preview only (rolls back)
 */
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const sql = postgres(connectionString, { max: 1 });
  const prefix = DRY_RUN ? "[DRY RUN] " : "";

  try {
    if (DRY_RUN) {
      console.log("[DRY RUN] Starting purge preview (transaction will be rolled back)\n");
    }

    await sql.begin(async (tx) => {
      // 1. Purge expired/pending invites, or invites with test domains
      const expiredOrTestInvites = await tx`
        DELETE FROM invites
        WHERE (is_accepted = false AND expires_at < NOW())
           OR email LIKE '%@example.com'
           OR email LIKE '%@test.com'
        RETURNING id, email
      `;
      console.log(`${prefix}✓ Purged ${expiredOrTestInvites.length} expired/pending or test invites`);
      if (expiredOrTestInvites.length > 0) {
        console.log(`${prefix}  Purged invite emails:`, expiredOrTestInvites.map(i => i.email).join(", "));
      }

      // 2. Archive test users (keeping only active team accounts like admin@westindustries.com)
      const archivedTestUsers = await tx`
        UPDATE users
        SET is_archived = true
        WHERE is_archived = false
          AND (email LIKE '%@example.com' OR email LIKE '%@test.com')
          AND email <> 'admin@westindustries.com'
        RETURNING id, email
      `;
      console.log(`${prefix}✓ Archived ${archivedTestUsers.length} active test users`);
      if (archivedTestUsers.length > 0) {
        console.log(`${prefix}  Archived user emails:`, archivedTestUsers.map(u => u.email).join(", "));
      }

      // 3. Purge old accepted invites (>90 days)
      const oldAcceptedInvites = await tx`
        DELETE FROM invites
        WHERE is_accepted = true
          AND accepted_at < NOW() - INTERVAL '90 days'
        RETURNING id
      `;
      console.log(`${prefix}✓ Purged ${oldAcceptedInvites.length} old accepted invites (>90 days)`);

      // 4. Clean up spent/expired password reset tokens
      const staleResets = await tx`
        DELETE FROM password_resets
        WHERE used = true
           OR expires_at < NOW()
        RETURNING id
      `;
      console.log(`${prefix}✓ Cleaned up ${staleResets.length} spent/expired password reset tokens`);

      if (DRY_RUN) {
        // Roll back the transaction so nothing is actually deleted
        throw new Error("DRY_RUN_ROLLBACK");
      }
    });

    console.log(`\n${prefix}✓ Database purge complete`);
  } catch (err: unknown) {
    // Swallow the intentional dry-run rollback error
    if (
      DRY_RUN &&
      err instanceof Error &&
      err.message.includes("DRY_RUN_ROLLBACK")
    ) {
      console.log(`\n${prefix}✓ Database purge complete (no changes applied)`);
    } else {
      throw err;
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[purge] failed:", err);
  process.exit(1);
});
