"use server";

import { db } from "@/db";
import { tickets, checklistItems, comments, users } from "../../drizzle/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAnyRole, requireSuperUser } from "@/lib/require-role";
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  UpdateStatusSchema,
} from "@/lib/validations";
import { revalidatePath } from "next/cache";

// ─── Get all tickets (grouped for board) ─────────────────────────────────────
export async function getTickets(includesClosed = false) {
  await requireAnyRole();

  const rows = await db
    .select({
      ticket: tickets,
      assignee: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
      checklistTotal: db.$count(checklistItems, eq(checklistItems.ticketId, tickets.id)),
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.assigneeId, users.id))
    .orderBy(
      asc(tickets.sortOrder),
      asc(tickets.createdAt)
    );

  return rows.filter((r) => {
    if (!includesClosed && r.ticket.status === "closed") return false;
    return true;
  });
}

// ─── Get ticket detail (for slide-over) ──────────────────────────────────────
export async function getTicketDetail(id: string) {
  await requireAnyRole();

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  if (!ticket) throw new Error("Ticket not found");

  const [checklist, ticketComments, allUsers] = await Promise.all([
    db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.ticketId, id))
      .orderBy(asc(checklistItems.sortOrder)),
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        authorId: comments.authorId,
        authorName: users.name,
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.ticketId, id))
      .orderBy(asc(comments.createdAt)),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.isArchived, false)),
  ]);

  let assignee = null;
  if (ticket.assigneeId) {
    const [a] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, ticket.assigneeId));
    assignee = a ?? null;
  }

  return { ticket, checklist, comments: ticketComments, assignee, allUsers };
}

// ─── Create ticket ────────────────────────────────────────────────────────────
export async function createTicket(data: unknown) {
  const { userId } = await requireSuperUser();
  const parsed = CreateTicketSchema.parse(data);

  const [ticket] = await db
    .insert(tickets)
    .values({
      ...parsed,
      creatorId: userId,
      deadline: parsed.deadline ? new Date(parsed.deadline) : null,
    })
    .returning();

  revalidatePath("/tasks");
  return ticket;
}

// ─── Update ticket ────────────────────────────────────────────────────────────
export async function updateTicket(id: string, data: unknown) {
  await requireSuperUser();
  const parsed = UpdateTicketSchema.parse(data);

  const [ticket] = await db
    .update(tickets)
    .set({
      ...parsed,
      deadline: parsed.deadline ? new Date(parsed.deadline) : null,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id))
    .returning();

  revalidatePath("/tasks");
  return ticket;
}

// ─── Update ticket status ─────────────────────────────────────────────────────
export async function updateTicketStatus(
  id: string,
  data: unknown
) {
  const { role, userId } = await requireAnyRole();
  const parsed = UpdateStatusSchema.parse(data);

  // Team member restriction: can only move to "review" if ticket is theirs and was "in_progress"
  if (role === "team_member") {
    const [existing] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);

    if (!existing) throw new Error("Ticket not found");

    const allowedTransitions: Record<string, string[]> = {
      in_progress: ["review"],
    };

    const allowed = allowedTransitions[existing.status] ?? [];
    if (!allowed.includes(parsed.status)) {
      throw new Error(
        `Forbidden: team_member cannot move from ${existing.status} to ${parsed.status}`
      );
    }

    if (existing.assigneeId !== userId) {
      throw new Error("Forbidden: you can only move your own tickets");
    }
  }

  const [ticket] = await db
    .update(tickets)
    .set({
      status: parsed.status,
      sortOrder: parsed.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id))
    .returning();

  revalidatePath("/tasks");
  return ticket;
}

// ─── Delete ticket ────────────────────────────────────────────────────────────
export async function deleteTicket(id: string) {
  await requireSuperUser();

  await db.delete(tickets).where(eq(tickets.id, id));
  revalidatePath("/tasks");
}
