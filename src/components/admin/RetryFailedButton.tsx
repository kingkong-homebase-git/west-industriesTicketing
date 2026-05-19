"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { retrySync } from "@/actions/sync";

export default function RetryFailedButton({ logId }: { logId: string }) {
  const [isPending, startTransition] = useTransition();

  const handle = () => {
    startTransition(async () => {
      try {
        const result = await retrySync(logId);
        if (result.ok) {
          toast.success("Retry queued — refresh to see the new log row");
        } else {
          toast.error(result.message ?? "Retry failed");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Retry failed");
      }
    });
  };

  return (
    <button
      onClick={handle}
      disabled={isPending}
      title="Retry"
      className="p-1.5 rounded-md text-text-secondary hover:text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors"
    >
      <RotateCw size={14} className={isPending ? "animate-spin" : ""} />
    </button>
  );
}
