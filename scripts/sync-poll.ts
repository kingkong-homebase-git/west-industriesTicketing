/**
 * Runs one Notion→dashboard pull cycle and exits.
 *
 * Invoked by PM2's cron_restart every 5 minutes (see ecosystem.config.js
 * "west-industries-sync" app). Also runnable manually:
 *   pnpm exec tsx scripts/sync-poll.ts
 *
 * Exit code 0 on success, 1 on failure — so PM2 and external monitors can
 * detect a broken sync. The sync_logs row written inside pullAllFromNotion
 * has the structured detail; this script just surfaces the outcome.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { pullAllFromNotion } from "../src/lib/sync/pull";

async function main() {
  const startedAt = Date.now();
  console.log("[sync-poll] starting pull");

  try {
    const result = await pullAllFromNotion();
    const elapsed = Date.now() - startedAt;
    console.log(
      `[sync-poll] done in ${elapsed}ms — pages=${result.totalPages} ` +
        `inserted=${result.inserted} updated=${result.updated} ` +
        `echoSkip=${result.skippedEcho} conflictSkip=${result.skippedConflict} ` +
        `errors=${result.errors}`
    );
    if (result.errors > 0) {
      console.error(
        `[sync-poll] completed with ${result.errors} per-page error(s) — see sync_logs`
      );
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error("[sync-poll] fatal:", err);
    process.exit(1);
  }
}

void main();
