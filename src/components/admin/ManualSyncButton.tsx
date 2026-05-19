"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { triggerManualPull } from "@/actions/sync";

export default function ManualSyncButton() {
  const [isPending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      try {
        const result = await triggerManualPull();
        if (result.errors > 0) {
          toast.error(
            `Pull completed with ${result.errors} error(s) — see logs`
          );
        } else {
          toast.success(
            `Pulled ${result.totalPages} page(s) (${result.inserted} new, ` +
              `${result.updated} updated, ${result.skippedEcho} echoed, ` +
              `${result.skippedConflict} conflict-skipped)`
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    });
  };

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
      {isPending ? "Syncing…" : "Sync now"}
    </button>
  );
}
