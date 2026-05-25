import { auth } from "@/auth";
import { db } from "@/db";
import {
  tickets,
  users,
  projects,
  checklistItems,
} from "../../../../drizzle/schema";
import { and, eq, notInArray } from "drizzle-orm";
import PriorityList from "@/components/tasks/PriorityList";

export const dynamic = "force-dynamic";

export default async function PriorityPage() {
  const session = await auth();
  const role = ((session?.user as any)?.role as string) ?? "team_member";
  const userId = session?.user?.id ?? "";

  // Urgent & Important, still active (not accomplished/failed), org-wide.
  const rows = await db
    .select({
      ticket: tickets,
      assigneeName: users.name,
      projectName: projects.name,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id))
    .leftJoin(projects, eq(tickets.projectId, projects.id))
    .where(
      and(
        eq(tickets.quadrant, "urgent_important"),
        notInArray(tickets.status, ["accomplished", "failed"])
      )
    );

  const checklistCounts = await db
    .select({ ticketId: checklistItems.ticketId, done: checklistItems.isDone })
    .from(checklistItems);

  const progressMap: Record<string, { done: number; total: number }> = {};
  for (const row of checklistCounts) {
    if (!progressMap[row.ticketId]) progressMap[row.ticketId] = { done: 0, total: 0 };
    progressMap[row.ticketId].total++;
    if (row.done) progressMap[row.ticketId].done++;
  }

  const ticketsWithMeta = rows.map((r) => ({
    ...r.ticket,
    assigneeName: r.assigneeName ?? null,
    projectName: r.projectName ?? null,
    checklistProgress: progressMap[r.ticket.id] ?? { done: 0, total: 0 },
  }));

  return (
    <PriorityList initialTickets={ticketsWithMeta} role={role} userId={userId} />
  );
}
