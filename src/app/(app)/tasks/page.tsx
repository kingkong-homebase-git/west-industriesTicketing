import { auth } from "@/auth";
import { db } from "@/db";
import { tickets, users } from "../../../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import KanbanBoard from "@/components/tasks/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  const role = ((session?.user as any)?.role as string) ?? "team_member";
  const userId = session?.user?.id ?? "";

  // Fetch all tickets (all statuses) for full board, but ONLY for the logged-in user
  const allRows = await db
    .select({
      ticket: tickets,
      assigneeName: users.name,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id))
    .where(eq(tickets.assigneeId, userId))
    .orderBy(asc(tickets.sortOrder), asc(tickets.createdAt));

  // Count checklist per ticket
  const { checklistItems } = await import("../../../../drizzle/schema");
  const checklistCounts = await db
    .select({
      ticketId: checklistItems.ticketId,
      done: checklistItems.isDone,
    })
    .from(checklistItems);

  // Build checklist progress map
  const progressMap: Record<string, { done: number; total: number }> = {};
  for (const row of checklistCounts) {
    if (!progressMap[row.ticketId]) {
      progressMap[row.ticketId] = { done: 0, total: 0 };
    }
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
    />
  );
}
