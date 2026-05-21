import { auth } from "@/auth";
import { db } from "@/db";
import { tickets, users } from "../../../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import TeamKanbanBoard from "@/components/tasks/TeamKanbanBoard";

export const dynamic = "force-dynamic";

export default async function TeamBoardPage() {
  const session = await auth();
  const role = ((session?.user as any)?.role as string) ?? "team_member";
  const userId = session?.user?.id ?? "";

  // Org-wide board is visible to all roles. Editing is still scoped per ticket
  // (see SlideOver/canEdit + server-side assertTicketAccess): team members can
  // only modify their own tickets here.

  // Fetch all users
  const allUsers = await db.select().from(users).where(eq(users.isArchived, false)).orderBy(users.name);

  // Fetch all tickets
  const allRows = await db
    .select({
      ticket: tickets,
      assigneeName: users.name,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id))
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

  // Team board shows active (non-closed) work only — hide accomplished/failed.
  const CLOSED = new Set(["accomplished", "failed"]);
  const ticketsWithMeta = allRows
    .filter((r) => !CLOSED.has(r.ticket.status))
    .map((r) => ({
      ...r.ticket,
      assigneeName: r.assigneeName ?? null,
      checklistProgress: progressMap[r.ticket.id] ?? { done: 0, total: 0 },
    }));

  return (
    <TeamKanbanBoard
      initialTickets={ticketsWithMeta}
      users={allUsers}
      role={role}
      userId={userId}
    />
  );
}
