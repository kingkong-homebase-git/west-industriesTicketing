import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getSyncLogs,
  getSyncStateSummary,
  type SyncLogRow,
} from "@/actions/sync";
import type {
  SyncDirection,
  SyncResultStatus,
} from "../../../../../drizzle/schema";
import SyncStatusCard from "@/components/admin/SyncStatusCard";
import SyncLogsTable from "@/components/admin/SyncLogsTable";
import ManualSyncButton from "@/components/admin/ManualSyncButton";

export const dynamic = "force-dynamic";

const VALID_DIRECTIONS = new Set<SyncDirection>(["push", "pull"]);
const VALID_STATUSES = new Set<SyncResultStatus>(["success", "failure"]);

export default async function SyncLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string; status?: string }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "super_user") redirect("/tasks");

  const params = await searchParams;
  const direction = VALID_DIRECTIONS.has(params.dir as SyncDirection)
    ? (params.dir as SyncDirection)
    : undefined;
  const status = VALID_STATUSES.has(params.status as SyncResultStatus)
    ? (params.status as SyncResultStatus)
    : undefined;

  const [summary, { rows, total }] = await Promise.all([
    getSyncStateSummary(),
    getSyncLogs({ direction, status, limit: 100 }),
  ]);

  // rows already match the SyncLogRow shape (server action returns it).
  const initialRows: SyncLogRow[] = rows;

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Sync logs</h1>
          <p className="text-sm text-text-secondary">
            Notion ⇄ dashboard sync activity. Failures can be retried inline.
          </p>
        </div>
        <ManualSyncButton />
      </div>

      <SyncStatusCard summary={summary} />
      <SyncLogsTable initialRows={initialRows} total={total} />
    </div>
  );
}
