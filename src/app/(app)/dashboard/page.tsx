import { auth } from "@/auth";
import { db } from "@/db";
import {
  tickets,
  users,
  comments,
  invites,
} from "../../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import DashboardClient from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

const DONE = new Set(["accomplished", "failed"]);

const STATUS_META: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "#94a3b8" },
  on_track: { label: "On Track", color: "#10b981" },
  behind: { label: "Behind", color: "#f59e0b" },
  at_risk: { label: "At Risk", color: "#fb923c" },
  reprioritized: { label: "Reprioritized", color: "#a78bfa" },
  accomplished: { label: "Accomplished", color: "#3b82f6" },
  failed: { label: "Failed", color: "#f43f5e" },
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export default async function DashboardPage() {
  const session = await auth();
  const role = ((session?.user as any)?.role as string) ?? "team_member";
  const userId = session?.user?.id ?? "";
  const userName = session?.user?.name ?? "there";
  const isPrivileged = role === "super_user" || role === "admin";

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  // ─── Tickets in scope (org-wide for privileged, own for team members) ───────
  const ticketQuery = db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      deadline: tickets.deadline,
      assigneeId: tickets.assigneeId,
      assigneeName: users.name,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id));
  const ticketRows = isPrivileged
    ? await ticketQuery
    : await ticketQuery.where(eq(tickets.assigneeId, userId));

  const active = ticketRows.filter((t) => !DONE.has(t.status));
  const overdue = active.filter((t) => t.deadline && new Date(t.deadline) < now);
  const dueThisWeek = active.filter(
    (t) =>
      t.deadline &&
      new Date(t.deadline) >= now &&
      new Date(t.deadline) <= weekFromNow
  );
  const accomplished = ticketRows.filter((t) => t.status === "accomplished");
  const completionRate =
    ticketRows.length > 0
      ? Math.round((accomplished.length / ticketRows.length) * 100)
      : 0;

  const kpis = {
    active: active.length,
    overdue: overdue.length,
    dueThisWeek: dueThisWeek.length,
    completionRate,
  };

  // ─── Status distribution ────────────────────────────────────────────────────
  const statusDistribution = Object.keys(STATUS_META)
    .map((s) => ({
      status: s,
      label: STATUS_META[s].label,
      color: STATUS_META[s].color,
      count: ticketRows.filter((t) => t.status === s).length,
    }))
    .filter((d) => d.count > 0);

  // ─── Weekly throughput (accomplished per week, last 8 weeks) ─────────────────
  const weeks: { week: string; label: string; completed: number }[] = [];
  const thisWeekStart = startOfWeek(now);
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(thisWeekStart.getTime() - i * 7 * 24 * 3600 * 1000);
    weeks.push({
      week: ws.toISOString(),
      label: ws.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      completed: 0,
    });
  }
  for (const t of accomplished) {
    if (!t.updatedAt) continue;
    const ws = startOfWeek(new Date(t.updatedAt)).toISOString();
    const bucket = weeks.find((w) => w.week === ws);
    if (bucket) bucket.completed++;
  }
  const throughput = weeks.map((w) => ({ label: w.label, completed: w.completed }));

  // ─── Workload by assignee (privileged only) ──────────────────────────────────
  let workload: { name: string; count: number }[] = [];
  if (isPrivileged) {
    const byAssignee = new Map<string, number>();
    for (const t of active) {
      const name = t.assigneeName ?? "Unassigned";
      byAssignee.set(name, (byAssignee.get(name) ?? 0) + 1);
    }
    workload = [...byAssignee.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  // ─── My Focus (signed-in user's own work) ────────────────────────────────────
  const myTickets = ticketRows.filter((t) => t.assigneeId === userId);
  const myActive = myTickets.filter((t) => !DONE.has(t.status));
  const myOverdue = myActive.filter(
    (t) => t.deadline && new Date(t.deadline) < now
  );
  const myWithDeadline = myActive
    .filter((t) => t.deadline)
    .sort(
      (a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
    );
  const myFocus = {
    open: myActive.length,
    overdue: myOverdue.length,
    nextDeadline: myWithDeadline[0]?.deadline
      ? new Date(myWithDeadline[0].deadline!).toISOString()
      : null,
    tickets: myActive
      .slice()
      .sort((a, b) => {
        const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return ad - bd;
      })
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        statusLabel: STATUS_META[t.status]?.label ?? t.status,
        deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
      })),
  };

  // ─── Upcoming deadlines (next 7 days, scope) ─────────────────────────────────
  const upcomingDeadlines = dueThisWeek
    .slice()
    .sort(
      (a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
    )
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      deadline: new Date(t.deadline!).toISOString(),
      assigneeName: t.assigneeName ?? "Unassigned",
      status: t.status,
      statusColor: STATUS_META[t.status]?.color ?? "#94a3b8",
    }));

  // ─── Recent activity (comments + recent ticket updates) ──────────────────────
  const commentRows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorName: users.name,
      ticketTitle: tickets.title,
      ticketAssignee: tickets.assigneeId,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .leftJoin(tickets, eq(comments.ticketId, tickets.id))
    .orderBy(desc(comments.createdAt))
    .limit(20);

  const scopedComments = isPrivileged
    ? commentRows
    : commentRows.filter((c) => c.ticketAssignee === userId);

  type Activity = { id: string; kind: string; text: string; time: string };
  const activity: Activity[] = [];
  for (const c of scopedComments.slice(0, 6)) {
    activity.push({
      id: `c-${c.id}`,
      kind: "comment",
      text: `${c.authorName ?? "Someone"} commented on “${c.ticketTitle ?? "a ticket"}”`,
      time: new Date(c.createdAt).toISOString(),
    });
  }
  for (const t of ticketRows
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime()
    )
    .slice(0, 6)) {
    if (!t.updatedAt) continue;
    activity.push({
      id: `t-${t.id}`,
      kind: "update",
      text: `“${t.title}” is ${STATUS_META[t.status]?.label ?? t.status}`,
      time: new Date(t.updatedAt).toISOString(),
    });
  }
  activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const recentActivity = activity.slice(0, 8);

  // ─── Team snapshot (privileged only) ─────────────────────────────────────────
  let team: { activeMembers: number; pendingInvites: number } | null = null;

  if (isPrivileged) {
    const [activeMembers, pendingInvites] = await Promise.all([
      db.$count(users, eq(users.isArchived, false)),
      db.$count(invites, eq(invites.isAccepted, false)),
    ]);
    team = { activeMembers, pendingInvites };
  }

  return (
    <DashboardClient
      data={{
        role,
        isPrivileged,
        userName,
        kpis,
        statusDistribution,
        throughput,
        workload,
        myFocus,
        upcomingDeadlines,
        recentActivity,
        team,
      }}
    />
  );
}
