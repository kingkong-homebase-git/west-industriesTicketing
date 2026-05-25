"use client";

import { useMemo } from "react";
import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  max as maxDate,
  min as minDate,
  startOfMonth,
} from "date-fns";
import { cn } from "@/lib/utils";
import { statusMeta } from "@/lib/ticket-meta";

interface TimelineViewProps {
  tickets: any[];
  onCardClick: (id: string) => void;
}

const LABEL_W = 176; // px — matches w-44

export default function TimelineView({ tickets, onCardClick }: TimelineViewProps) {
  const { rows, months, trackWidth, totalDays, rangeStart, todayLeftPx } = useMemo(() => {
    const dated = tickets
      .filter((t) => t.deadline)
      .map((t) => {
        const created = t.createdAt ? new Date(t.createdAt) : new Date(t.deadline);
        const due = new Date(t.deadline);
        const start = minDate([created, due]);
        const end = maxDate([created, due]);
        return { ticket: t, start, end };
      });

    if (dated.length === 0) {
      return {
        rows: [],
        months: [] as Date[],
        trackWidth: 0,
        totalDays: 0,
        rangeStart: new Date(),
        todayLeftPx: -1,
      };
    }

    const rangeStart = startOfMonth(minDate(dated.map((d) => d.start)));
    const rangeEnd = endOfMonth(maxDate(dated.map((d) => d.end)));
    const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1);
    const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
    const trackWidth = Math.max(months.length * 150, 560);

    const rows = dated
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(({ ticket, start, end }) => {
        const offset = differenceInCalendarDays(start, rangeStart);
        const dur = Math.max(1, differenceInCalendarDays(end, start) + 1);
        return {
          ticket,
          leftPct: (offset / totalDays) * 100,
          widthPct: (dur / totalDays) * 100,
        };
      });

    const todayOffset = differenceInCalendarDays(new Date(), rangeStart);
    const todayLeftPx =
      todayOffset >= 0 && todayOffset <= totalDays
        ? LABEL_W + (todayOffset / totalDays) * trackWidth
        : -1;

    return { rows, months, trackWidth, totalDays, rangeStart, todayLeftPx };
  }, [tickets]);

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-text-secondary/60 border-2 border-dashed border-border/30 rounded-xl">
        No tasks with a deadline to plot.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-border/40">
      <div style={{ minWidth: LABEL_W + trackWidth }}>
        {/* Month header */}
        <div className="flex sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border/40">
          <div
            className="shrink-0 px-3 py-2 text-xs font-semibold text-text-secondary border-r border-border/40"
            style={{ width: LABEL_W }}
          >
            Task
          </div>
          <div className="relative" style={{ width: trackWidth, height: 33 }}>
            {months.map((m) => {
              const left =
                (differenceInCalendarDays(m, rangeStart) / totalDays) * 100;
              return (
                <div
                  key={m.toISOString()}
                  className="absolute top-0 h-full border-l border-border/30 pl-2 text-[11px] font-medium text-text-secondary flex items-center"
                  style={{ left: `${left}%` }}
                >
                  {format(m, "MMM yyyy")}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {todayLeftPx >= 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-accent/60 z-0 pointer-events-none"
              style={{ left: todayLeftPx }}
            />
          )}
          {rows.map(({ ticket, leftPct, widthPct }) => {
            const meta = statusMeta(ticket.status);
            return (
              <div
                key={ticket.id}
                className="flex items-center border-b border-border/20 hover:bg-surface/30 transition-colors"
              >
                <button
                  onClick={() => onCardClick(ticket.id)}
                  className="shrink-0 px-3 py-2.5 text-left text-xs text-text-primary truncate border-r border-border/40 hover:text-accent transition-colors"
                  style={{ width: LABEL_W }}
                  title={ticket.title}
                >
                  {ticket.title}
                </button>
                <div className="relative py-2.5" style={{ width: trackWidth }}>
                  <button
                    onClick={() => onCardClick(ticket.id)}
                    className={cn(
                      "absolute h-5 rounded-md top-1/2 -translate-y-1/2 hover:ring-2 hover:ring-accent/60 transition-all min-w-[6px]"
                    )}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: meta.color,
                    }}
                    title={`${ticket.title} · due ${format(new Date(ticket.deadline), "MMM d, yyyy")}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
