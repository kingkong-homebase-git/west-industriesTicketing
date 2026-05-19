import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import type { SyncStateSummary } from "@/actions/sync";

export default function SyncStatusCard({
  summary,
}: {
  summary: SyncStateSummary;
}) {
  const ok = summary.lastPollStatus === "success";
  const never = summary.lastPollStatus === null;

  return (
    <div className="bg-surface/30 backdrop-blur-md border border-border/60 p-5 rounded-2xl shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">
          Sync status
        </h2>
        <span
          className={
            never
              ? "text-xs font-medium bg-text-secondary/10 text-text-secondary px-2 py-1 rounded-full"
              : ok
                ? "text-xs font-medium bg-success/20 text-success px-2 py-1 rounded-full"
                : "text-xs font-medium bg-danger/20 text-danger px-2 py-1 rounded-full"
          }
        >
          {never ? "Never run" : ok ? "Healthy" : "Failing"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-xs text-text-secondary">Last poll</div>
          <div className="flex items-center gap-2 text-text-primary">
            <Clock size={14} className="text-text-secondary" />
            {summary.lastPollAt
              ? formatDistanceToNow(summary.lastPollAt, { addSuffix: true })
              : "—"}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-text-secondary">Outcome</div>
          <div className="flex items-center gap-2 text-text-primary">
            {ok ? (
              <CheckCircle2 size={14} className="text-success" />
            ) : never ? (
              <Clock size={14} className="text-text-secondary" />
            ) : (
              <AlertTriangle size={14} className="text-danger" />
            )}
            {summary.lastPollStatus ?? "—"}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-text-secondary">Failures (24h)</div>
          <div className="text-text-primary">{summary.failuresLast24h}</div>
        </div>
      </div>

      {summary.lastPollError && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-md p-2 font-mono break-all">
          {summary.lastPollError}
        </div>
      )}
    </div>
  );
}
