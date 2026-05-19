"use server";

import { requireSuperUser } from "@/lib/require-role";
import { pullAllFromNotion, type PullResult } from "@/lib/sync/pull";
import { revalidatePath } from "next/cache";

/**
 * Force-run a single Notion → dashboard pull cycle. Intended for the
 * "Sync now" button on /admin/sync-logs. Reuses the same code path as the
 * scheduled PM2 worker, so behavior is identical to a regular tick.
 */
export async function triggerManualPull(): Promise<PullResult> {
  await requireSuperUser();
  const result = await pullAllFromNotion();
  revalidatePath("/admin/sync-logs");
  revalidatePath("/tasks");
  return result;
}
