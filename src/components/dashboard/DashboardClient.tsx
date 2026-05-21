"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Flame,
  Gauge,
  ListChecks,
  RefreshCw,
  Users,
} from "lucide-react";

// ─── Types (mirror the server page's data object) ────────────────────────────
interface DashboardData {
  role: string;
  isPrivileged: boolean;
  userName: string;
  kpis: { active: number; overdue: number; dueThisWeek: number; completionRate: number };
  statusDistribution: { status: string; label: string; color: string; count: number }[];
  throughput: { label: string; completed: number }[];
  workload: { name: string; count: number }[];
  myFocus: {
    open: number;
    overdue: number;
    nextDeadline: string | null;
    tickets: { id: string; title: string; status: string; statusLabel: string; deadline: string | null }[];
  };
  upcomingDeadlines: {
    id: string;
    title: string;
    deadline: string;
    assigneeName: string;
    status: string;
    statusColor: string;
  }[];
  recentActivity: { id: string; kind: string; text: string; time: string }[];
  syncHealth: {
    lastPollAt: string | null;
    lastPollStatus: string | null;
    pushes24h: number;
    pulls24h: number;
  } | null;
  team: { activeMembers: number; pendingInvites: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function deadlineLabel(iso: string | null): { text: string; tone: "danger" | "warning" | "normal" } {
  if (!iso) return { text: "No deadline", tone: "normal" };
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 3600 * 1000));
  const text = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days < 0) return { text: `${text} · overdue`, tone: "danger" };
  if (days <= 2) return { text: `${text} · ${days === 0 ? "today" : `${days}d`}`, tone: "warning" };
  return { text, tone: "normal" };
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = ref.current;
    const duration = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}

// ─── Donut (status distribution) ──────────────────────────────────────────────
function Donut({ segments }: { segments: { color: string; count: number; label: string }[] }) {
  const total = segments.reduce((a, s) => a + s.count, 0);
  const size = 168;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth={stroke} />
          {total > 0 &&
            segments.map((s) => {
              const len = (s.count / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="text-3xl font-bold text-text-primary leading-none">{total}</span>
          <span className="text-[10px] uppercase tracking-widest text-text-secondary mt-1">Tickets</span>
        </div>
      </div>
      <div className="flex-1 min-w-[120px] space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-text-secondary">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold text-text-primary">{s.count}</span>
          </div>
        ))}
        {segments.length === 0 && <p className="text-sm text-text-secondary italic">No tickets yet.</p>}
      </div>
    </div>
  );
}

// ─── Card shell ───────────────────────────────────────────────────────────────
function Card({
  title,
  icon,
  children,
  className = "",
  action,
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`bg-surface/40 backdrop-blur-xl border border-border/60 rounded-2xl p-5 shadow-xl hover:border-accent/30 transition-colors duration-300 ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {icon}
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function Kpi({
  label,
  value,
  suffix,
  icon,
  accent,
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden bg-surface/40 backdrop-blur-xl border border-border/60 rounded-2xl p-5 shadow-xl">
      <div
        className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-25"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
        <span className="p-1.5 rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
          {icon}
        </span>
      </div>
      <div className="relative mt-3 text-4xl font-bold text-text-primary tabular-nums">
        <AnimatedCounter value={value} suffix={suffix} />
      </div>
      {hint && <div className="relative mt-1 text-xs text-text-secondary">{hint}</div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardClient({ data }: { data: DashboardData }) {
  const { kpis, myFocus, isPrivileged } = data;
  const maxThroughput = Math.max(1, ...data.throughput.map((w) => w.completed));
  const maxWorkload = Math.max(1, ...data.workload.map((w) => w.count));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-4">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
          {greeting}, {data.userName.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {isPrivileged ? "Here's how the whole workspace is tracking." : "Here's your work at a glance."}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Active" value={kpis.active} icon={<CircleDot size={16} />} accent="#3b82f6" hint="Open tickets" />
        <Kpi label="Overdue" value={kpis.overdue} icon={<Flame size={16} />} accent="#f43f5e" hint="Past deadline" />
        <Kpi label="Due this week" value={kpis.dueThisWeek} icon={<AlarmClock size={16} />} accent="#f59e0b" hint="Next 7 days" />
        <Kpi label="Completion" value={kpis.completionRate} suffix="%" icon={<Gauge size={16} />} accent="#10b981" hint="Accomplished / total" />
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Status distribution */}
        <Card title="Status breakdown" icon={<ListChecks size={16} className="text-accent" />} className="md:col-span-2 xl:col-span-1">
          <Donut segments={data.statusDistribution} />
        </Card>

        {/* Throughput */}
        <Card title="Weekly throughput" icon={<Activity size={16} className="text-accent" />} className="xl:col-span-2">
          <div className="flex items-end justify-between gap-2 h-40 pt-2">
            {data.throughput.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-accent/40 to-accent transition-all duration-500"
                    style={{ height: `${(w.completed / maxThroughput) * 100}%`, minHeight: w.completed > 0 ? 6 : 2 }}
                    title={`${w.completed} completed`}
                  />
                </div>
                <span className="text-[10px] text-text-secondary whitespace-nowrap">{w.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-secondary mt-2">Tickets marked accomplished, per week.</p>
        </Card>

        {/* My Focus */}
        <Card title="My focus" icon={<CheckCircle2 size={16} className="text-accent" />}>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 rounded-xl bg-surface-2/30 border border-border/40 p-3">
              <div className="text-2xl font-bold text-text-primary"><AnimatedCounter value={myFocus.open} /></div>
              <div className="text-xs text-text-secondary">Open</div>
            </div>
            <div className="flex-1 rounded-xl bg-surface-2/30 border border-border/40 p-3">
              <div className="text-2xl font-bold text-danger"><AnimatedCounter value={myFocus.overdue} /></div>
              <div className="text-xs text-text-secondary">Overdue</div>
            </div>
          </div>
          <div className="space-y-2">
            {myFocus.tickets.map((t) => {
              const dl = deadlineLabel(t.deadline);
              return (
                <Link
                  key={t.id}
                  href="/tasks"
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-surface-2/40 transition-colors"
                >
                  <span className="text-sm text-text-primary truncate">{t.title}</span>
                  <span
                    className={`text-[11px] whitespace-nowrap ${
                      dl.tone === "danger" ? "text-danger" : dl.tone === "warning" ? "text-warning" : "text-text-secondary"
                    }`}
                  >
                    {dl.text}
                  </span>
                </Link>
              );
            })}
            {myFocus.tickets.length === 0 && (
              <p className="text-sm text-text-secondary italic py-2">Nothing assigned to you. 🎉</p>
            )}
          </div>
        </Card>

        {/* Upcoming deadlines */}
        <Card
          title="Upcoming deadlines"
          icon={<CalendarClock size={16} className="text-accent" />}
          className="xl:col-span-2"
        >
          <div className="space-y-2">
            {data.upcomingDeadlines.map((t) => {
              const dl = deadlineLabel(t.deadline);
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-surface-2/20 border border-border/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.statusColor }} />
                    <span className="text-sm text-text-primary truncate">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-text-secondary hidden sm:inline">{t.assigneeName}</span>
                    <span className={`text-[11px] font-medium ${dl.tone === "danger" ? "text-danger" : dl.tone === "warning" ? "text-warning" : "text-text-secondary"}`}>
                      {dl.text}
                    </span>
                  </div>
                </div>
              );
            })}
            {data.upcomingDeadlines.length === 0 && (
              <p className="text-sm text-text-secondary italic py-2">No deadlines in the next 7 days.</p>
            )}
          </div>
        </Card>

        {/* Workload (privileged) */}
        {isPrivileged && (
          <Card title="Workload by assignee" icon={<Users size={16} className="text-accent" />}>
            <div className="space-y-3">
              {data.workload.map((w) => (
                <div key={w.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-secondary truncate">{w.name}</span>
                    <span className="text-text-primary font-semibold">{w.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-all duration-500"
                      style={{ width: `${(w.count / maxWorkload) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {data.workload.length === 0 && <p className="text-sm text-text-secondary italic">No active tickets.</p>}
            </div>
          </Card>
        )}

        {/* Recent activity */}
        <Card title="Recent activity" icon={<Activity size={16} className="text-accent" />}>
          <div className="space-y-3">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${a.kind === "comment" ? "bg-accent" : "bg-success"}`} />
                <div className="min-w-0">
                  <p className="text-sm text-text-primary leading-snug">{a.text}</p>
                  <p className="text-[11px] text-text-secondary">{relativeTime(a.time)}</p>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && <p className="text-sm text-text-secondary italic">No recent activity.</p>}
          </div>
        </Card>

        {/* Sync health (privileged) */}
        {isPrivileged && data.syncHealth && (
          <Card
            title="Notion sync"
            icon={<RefreshCw size={16} className="text-accent" />}
            action={
              <Link href="/admin/sync-logs" className="text-xs text-accent hover:underline">
                Logs
              </Link>
            }
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`w-2.5 h-2.5 rounded-full ${data.syncHealth.lastPollStatus === "success" ? "bg-success animate-pulse" : data.syncHealth.lastPollStatus ? "bg-danger" : "bg-text-secondary"}`}
              />
              <span className="text-sm font-medium text-text-primary capitalize">
                {data.syncHealth.lastPollStatus ?? "no data"}
              </span>
              <span className="text-xs text-text-secondary ml-auto">
                {data.syncHealth.lastPollAt ? relativeTime(data.syncHealth.lastPollAt) : "—"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2/30 border border-border/40 p-3">
                <div className="text-xl font-bold text-text-primary">{data.syncHealth.pulls24h}</div>
                <div className="text-xs text-text-secondary">Pulls / 24h</div>
              </div>
              <div className="rounded-xl bg-surface-2/30 border border-border/40 p-3">
                <div className="text-xl font-bold text-text-primary">{data.syncHealth.pushes24h}</div>
                <div className="text-xs text-text-secondary">Pushes / 24h</div>
              </div>
            </div>
          </Card>
        )}

        {/* Team snapshot (privileged) */}
        {isPrivileged && data.team && (
          <Card title="Team" icon={<Users size={16} className="text-accent" />} action={<Link href="/team" className="text-xs text-accent hover:underline">Manage</Link>}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-2/30 border border-border/40 p-3">
                <div className="text-2xl font-bold text-text-primary"><AnimatedCounter value={data.team.activeMembers} /></div>
                <div className="text-xs text-text-secondary">Active members</div>
              </div>
              <div className="rounded-xl bg-surface-2/30 border border-border/40 p-3">
                <div className="text-2xl font-bold text-warning"><AnimatedCounter value={data.team.pendingInvites} /></div>
                <div className="text-xs text-text-secondary">Pending invites</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
