import { auth } from "@/auth";
import { db } from "@/db";
import { tickets, users, projects, checklistItems } from "../../../../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import KanbanBoard from "@/components/tasks/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = ((session?.user as any)?.role as string) ?? "team_member";
  const userId = session?.user?.id ?? "";

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!project) notFound();

  const allRows = await db
    .select({ ticket: tickets, assigneeName: users.name })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id))
    .where(eq(tickets.projectId, id))
    .orderBy(asc(tickets.sortOrder), asc(tickets.createdAt));

  const checklistCounts = await db
    .select({ ticketId: checklistItems.ticketId, done: checklistItems.isDone })
    .from(checklistItems);

  const progressMap: Record<string, { done: number; total: number }> = {};
  for (const row of checklistCounts) {
    if (!progressMap[row.ticketId]) progressMap[row.ticketId] = { done: 0, total: 0 };
    progressMap[row.ticketId].total++;
    if (row.done) progressMap[row.ticketId].done++;
  }

  const ticketsWithMeta = allRows.map((r) => ({
    ...r.ticket,
    assigneeName: r.assigneeName ?? null,
    checklistProgress: progressMap[r.ticket.id] ?? { done: 0, total: 0 },
  }));

  return (
    <KanbanBoard
      initialTickets={ticketsWithMeta}
      role={role}
      userId={userId}
      title={project.name}
    />
  );
}
