"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, XCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import RetryFailedButton from "./RetryFailedButton";
import type { SyncLogRow } from "@/actions/sync";

type Direction = "" | "push" | "pull";
type Status = "" | "success" | "failure";

export default function SyncLogsTable({
  initialRows,
  total,
}: {
  initialRows: SyncLogRow[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const direction = (searchParams.get("dir") ?? "") as Direction;
  const status = (searchParams.get("status") ?? "") as Status;

  const setFilter = (next: { dir?: Direction; status?: Status }) => {
    const params = new URLSearchParams(searchParams);
    if (next.dir !== undefined) {
      if (next.dir) params.set("dir", next.dir);
      else params.delete("dir");
    }
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="bg-surface/30 backdrop-blur-md border border-border/60 rounded-2xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
        <div className="text-sm font-semibold text-text-primary">
          Sync log <span className="text-text-secondary font-normal">({total} total)</span>
        </div>
        <div className="flex items-center gap-2">
          <FilterPicker
            label="Direction"
            value={direction}
            options={[
              { value: "", label: "All" },
              { value: "push", label: "Push" },
              { value: "pull", label: "Pull" },
            ]}
            onChange={(v) => setFilter({ dir: v as Direction })}
          />
          <FilterPicker
            label="Status"
            value={status}
            options={[
              { value: "", label: "All" },
              { value: "success", label: "Success" },
              { value: "failure", label: "Failure" },
            ]}
            onChange={(v) => setFilter({ status: v as Status })}
          />
        </div>
      </div>

      {initialRows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-text-secondary">
          No log entries match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-border/40">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Dir</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Entity / Page</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Error</th>
                <th className="px-3 py-2 font-medium w-12" />
              </tr>
            </thead>
            <tbody>
              {initialRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/20 last:border-0 hover:bg-surface-2/20 transition-colors"
                >
                  <td className="px-5 py-2 text-text-primary whitespace-nowrap font-mono text-xs">
                    {format(row.createdAt, "MMM d HH:mm:ss")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 text-text-primary">
                      {row.direction === "push" ? (
                        <ArrowUpRight size={12} className="text-accent" />
                      ) : (
                        <ArrowDownLeft size={12} className="text-warning" />
                      )}
                      <span className="text-xs">{row.direction}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {row.status === "success" ? (
                      <CheckCircle2 size={14} className="text-success" />
                    ) : (
                      <XCircle size={14} className="text-danger" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary truncate max-w-[200px]">
                    {row.entityId
                      ? row.entityId.slice(0, 8)
                      : row.notionPageId
                        ? row.notionPageId.slice(0, 12)
                        : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-text-secondary">
                    {row.durationMs != null ? `${row.durationMs}ms` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-danger/80 truncate max-w-[300px]">
                    {row.errorMessage ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.status === "failure" && (
                      <RetryFailedButton logId={row.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-text-secondary">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface/40 border border-border/60 text-text-primary text-xs rounded-md px-2 py-1 outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
