"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Link2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getJacquesCalendarEvents } from "@/actions/google";

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string | null;
  location: string | null;
}

interface JacquesCalendarProps {
  connected: boolean;
  email: string | null;
  configured: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function JacquesCalendar({
  connected,
  email,
  configured,
}: JacquesCalendarProps) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const { gridStart, gridEnd, days } = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor));
    const gridEnd = endOfWeek(endOfMonth(cursor));
    return {
      gridStart,
      gridEnd,
      days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
    };
  }, [cursor]);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const res = await getJacquesCalendarEvents(
        gridStart.toISOString(),
        gridEnd.toISOString()
      );
      if (!res.ok) {
        toast.error(res.error || "Couldn't load calendar");
        setEvents([]);
      } else {
        setEvents(res.events);
      }
    } catch (err: any) {
      toast.error(err?.message || "Couldn't load calendar");
    } finally {
      setLoading(false);
    }
  }, [connected, gridStart, gridEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = format(new Date(e.start), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Disconnected");
      router.refresh();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setBusy(false);
    }
  };

  // ── Not configured / not connected states ──
  if (!configured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/40 rounded-2xl p-10 text-text-secondary">
        <Calendar size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">Google Calendar isn&apos;t configured on the server.</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/40 rounded-2xl p-10">
        <Calendar size={36} className="mb-4 text-accent" />
        <h2 className="text-lg font-semibold text-text-primary">Connect Jacques&apos;s calendar</h2>
        <p className="text-sm text-text-secondary mt-1 mb-5 max-w-md">
          Authorize once to show a live, read-only view of jacquesmwest@gmail.com&apos;s
          Google Calendar here, in the Hemisphere theme.
        </p>
        <a
          href="/api/google/connect"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
        >
          <Link2 size={16} /> Connect Google Calendar
        </a>
      </div>
    );
  }

  // ── Connected: live calendar ──
  return (
    <div className="flex-1 flex flex-col min-h-0 gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {format(cursor, "MMMM yyyy")}
          </h2>
          {loading && <RefreshCw size={15} className="text-text-secondary animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
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
          <div key={d} className="text-center text-xs font-semibold text-text-secondary py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40 flex-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[110px] p-1.5 flex flex-col gap-1 bg-surface/20 backdrop-blur-sm",
                !inMonth && "opacity-40"
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                  isToday(day) ? "bg-accent text-white" : "text-text-secondary"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayEvents.slice(0, 4).map((e) => (
                  <a
                    key={e.id}
                    href={e.htmlLink ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${e.title}${e.location ? ` · ${e.location}` : ""}`}
                    className="text-left text-[11px] leading-tight px-1.5 py-1 rounded-md bg-accent/15 hover:bg-accent/25 border border-accent/20 transition-colors flex items-center gap-1 min-w-0"
                  >
                    {!e.allDay && (
                      <span className="text-[10px] text-accent font-medium shrink-0">
                        {format(new Date(e.start), "HH:mm")}
                      </span>
                    )}
                    <span className="truncate text-text-primary">{e.title}</span>
                  </a>
                ))}
                {dayEvents.length > 4 && (
                  <span className="text-[10px] text-text-secondary pl-1">
                    +{dayEvents.length - 4} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary shrink-0">
        <span>Read-only view of {email ?? "the connected calendar"}.</span>
        <button
          onClick={handleDisconnect}
          disabled={busy}
          className="inline-flex items-center gap-1.5 hover:text-danger transition-colors disabled:opacity-50"
        >
          <Unlink size={13} /> Disconnect
        </button>
      </div>
    </div>
  );
}
