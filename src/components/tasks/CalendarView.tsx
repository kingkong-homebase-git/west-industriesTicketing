"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta } from "@/lib/ticket-meta";

interface CalendarViewProps {
  tickets: any[];
  onCardClick: (id: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({ tickets, onCardClick }: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => new Date());

  const { days, byDay, unscheduled } = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor));
    const gridEnd = endOfWeek(endOfMonth(cursor));
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const byDay = new Map<string, any[]>();
    const unscheduled: any[] = [];
    for (const t of tickets) {
      if (!t.deadline) {
        unscheduled.push(t);
        continue;
      }
      const key = format(new Date(t.deadline), "yyyy-MM-dd");
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(t);
    }
    return { days, byDay, unscheduled };
  }, [cursor, tickets]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">
          {format(cursor, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="p-2 rounded-lg border border-border/60 text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-3 py-2 rounded-lg border border-border/60 text-sm text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="p-2 rounded-lg border border-border/60 text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-text-secondary py-2"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40 flex-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTickets = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[96px] p-1.5 flex flex-col gap-1 bg-surface/20 backdrop-blur-sm",
                !inMonth && "opacity-40"
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                  isToday(day)
                    ? "bg-accent text-white"
                    : "text-text-secondary"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayTickets.slice(0, 3).map((t) => {
                  const meta = statusMeta(t.status);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onCardClick(t.id)}
                      className="text-left text-[11px] leading-tight px-1.5 py-1 rounded-md bg-surface/50 hover:bg-surface border border-border/30 hover:border-accent/50 transition-colors flex items-center gap-1 min-w-0"
                      title={t.title}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="truncate text-text-primary">{t.title}</span>
                    </button>
                  );
                })}
                {dayTickets.length > 3 && (
                  <span className="text-[10px] text-text-secondary pl-1">
                    +{dayTickets.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <div className="shrink-0">
          <div className="text-xs font-semibold text-text-secondary mb-2">
            No deadline ({unscheduled.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((t) => {
              const meta = statusMeta(t.status);
              return (
                <button
                  key={t.id}
                  onClick={() => onCardClick(t.id)}
                  className="text-[11px] px-2 py-1 rounded-md bg-surface/40 hover:bg-surface border border-border/40 hover:border-accent/50 transition-colors flex items-center gap-1.5"
                  title={t.title}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="truncate max-w-[160px] text-text-primary">
                    {t.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
