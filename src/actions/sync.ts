"use server";

import { db } from "@/db";
import {
  syncLogs,
  syncState,
  tickets,
  type SyncDirection,
  type SyncResultStatus,
} from "../../drizzle/schema";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { requireSuperUser } from "@/lib/require-role";
import { pullAllFromNotion, type PullResult } from "@/lib/sync/pull";
import { pushTicketToNotion } from "@/lib/sync/push";
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

export type SyncLogRow = {
  id: string;
  direction: SyncDirection;
  entityType: string;
  entityId: string | null;
  notionPageId: string | null;
  status: SyncResultStatus;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
};

export async function getSyncLogs(filters?: {
  direction?: SyncDirection;
  status?: SyncResultStatus;
  limit?: number;
  offset?: number;
}): Promise<{ rows: SyncLogRow[]; total: number }> {
  await requireSuperUser();

  const conditions: SQL[] = [];
  if (filters?.direction) {
    conditions.push(eq(syncLogs.direction, filters.direction));
  }
  if (filters?.status) {
    conditions.push(eq(syncLogs.status, filters.status));
  }

  const whereExpr =
    conditions.length > 0 ? and(...conditions) : undefined;

  const limit = Math.min(filters?.limit ?? 100, 500);
  const offset = filters?.offset ?? 0;

  const rowsQuery = db
    .select({
      id: syncLogs.id,
      direction: syncLogs.direction,
      entityType: syncLogs.entityType,
      entityId: syncLogs.entityId,
      notionPageId: syncLogs.notionPageId,
      status: syncLogs.status,
      errorMessage: syncLogs.errorMessage,
      durationMs: syncLogs.durationMs,
      createdAt: syncLogs.createdAt,
    })
    .from(syncLogs)
    .orderBy(desc(syncLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const rows = whereExpr ? await rowsQuery.where(whereExpr) : await rowsQuery;

  const totalQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(syncLogs);
  const totalRow = whereExpr
    ? await totalQuery.where(whereExpr)
    : await totalQuery;

  return { rows, total: totalRow[0]?.count ?? 0 };
}

export type SyncStateSummary = {
  lastPollAt: Date | null;
  lastPollStatus: SyncResultStatus | null;
  lastPollError: string | null;
  failuresLast24h: number;
};

export async function getSyncStateSummary(): Promise<SyncStateSummary> {
  await requireSuperUser();

  const [state] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.id, 1))
    .limit(1);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failureCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(syncLogs)
    .where(
      and(eq(syncLogs.status, "failure"), gte(syncLogs.createdAt, since))
    );

  return {
    lastPollAt: state?.lastPollAt ?? null,
    lastPollStatus: state?.lastPollStatus ?? null,
    lastPollError: state?.lastPollError ?? null,
    failuresLast24h: failureCount?.count ?? 0,
  };
}

/**
 * Re-run the sync operation that produced a given log row.
 *
 * push → re-push the entity ticket.
 * pull → easiest correct behavior is a full re-poll (per-page retry would
 *   require splitting pull.ts; the prompt accepts this scope).
 */
export async function retrySync(
  syncLogId: string
): Promise<{ ok: boolean; message?: string }> {
  await requireSuperUser();

  const [log] = await db
    .select()
    .from(syncLogs)
    .where(eq(syncLogs.id, syncLogId))
    .limit(1);

  if (!log) return { ok: false, message: "Log entry not found" };

  if (log.direction === "push") {
    if (!log.entityId) {
      return { ok: false, message: "Push log has no entityId to retry" };
    }
    // Guard: ticket may have been deleted since the failed push.
    const [exists] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, log.entityId))
      .limit(1);
    if (!exists) {
      return { ok: false, message: "Ticket no longer exists" };
    }
    await pushTicketToNotion(log.entityId);
    revalidatePath("/admin/sync-logs");
    return { ok: true };
  }

  // direction === "pull"
  await pullAllFromNotion();
  revalidatePath("/admin/sync-logs");
  return { ok: true };
}

/**
 * Lightweight read for the kanban toast hook. Returns just the sync_status
 * column so a 3-second-after-edit poll doesn't drag in the whole ticket.
 */
export async function getTicketSyncStatus(
  ticketId: string
): Promise<{ status: string } | null> {
  await requireSuperUser();
  const [row] = await db
    .select({ status: tickets.notionSyncStatus })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  return row ?? null;
}
