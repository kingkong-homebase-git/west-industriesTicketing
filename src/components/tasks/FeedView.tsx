"use client";

import { useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { CheckSquare } from "lucide-react";
import { getInitials, relativeTime } from "@/lib/utils";
import { priorityMeta, statusMeta } from "@/lib/ticket-meta";
import DeadlineBadge from "./DeadlineBadge";

interface FeedViewProps {
  tickets: any[];
  onCardClick: (id: string) => void;
}

function dayLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

export default function FeedView({ tickets, onCardClick }: FeedViewProps) {
  const groups = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => {
      const at = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bt = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bt - at;
    });

    const out: { label: string; items: any[] }[] = [];
    for (const t of sorted) {
      const d = new Date(t.updatedAt ?? t.createdAt);
      const label = dayLabel(d);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(t);
      else out.push({ label, items: [t] });
    }
    return out;
  }, [tickets]);

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-text-secondary/60 border-2 border-dashed border-border/30 rounded-xl">
        Nothing here yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto kanban-col-scroll pr-1">
      <div className="max-w-2xl mx-auto space-y-6">
        {groups.map((g) => (
          <div key={g.label} className="space-y-2">
            <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide sticky top-0 bg-surface/60 backdrop-blur-md py-1">
              {g.label}
            </div>
            {g.items.map((t) => {
              const sMeta = statusMeta(t.status);
              const pMeta = priorityMeta(t.priority);
              const total = t.checklistProgress?.total ?? 0;
              const done = t.checklistProgress?.done ?? 0;
              return (
                <button
                  key={t.id}
                  onClick={() => onCardClick(t.id)}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-xl bg-surface/30 backdrop-blur-md border border-border/50 hover:border-accent/50 hover:bg-surface/50 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: sMeta.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {t.title}
                      </span>
                      <span className="text-[10px] text-text-secondary shrink-0">
                        {relativeTime(t.updatedAt ?? t.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          color: sMeta.color,
                          backgroundColor: `${sMeta.color}1a`,
                        }}
                      >
                        {sMeta.label}
                      </span>
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: pMeta.color }}
                      >
                        {pMeta.label}
                      </span>
                      <DeadlineBadge deadline={t.deadline} />
                      {total > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-text-secondary">
                          <CheckSquare size={11} />
                          {done}/{total}
                        </span>
                      )}
                      {t.assigneeName && (
                        <span className="flex items-center gap-1 text-[10px] text-text-secondary ml-auto">
                          <span className="w-4 h-4 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[8px]">
                            {getInitials(t.assigneeName)}
                          </span>
                          {t.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
