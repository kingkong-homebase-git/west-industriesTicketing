"use server";

import { db } from "@/db";
import {
  tickets,
  checklistItems,
  comments,
  users,
  attachments,
} from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { requireAnyRole, isPrivilegedRole } from "@/lib/require-role";
import { assertTicketAccess } from "@/lib/ticket-access";
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  UpdateStatusSchema,
} from "@/lib/validations";
import { revalidatePath } from "next/cache";

// ─── Get all tickets (grouped for board) ─────────────────────────────────────
export async function getTickets() {
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

  return rows;
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

  const [checklist, ticketComments, ticketAttachments, allUsers] =
    await Promise.all([
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
      // Metadata only — never select the `data` blob here.
      db
        .select({
          id: attachments.id,
          kind: attachments.kind,
          url: attachments.url,
          filename: attachments.filename,
          mimeType: attachments.mimeType,
          size: attachments.size,
          createdAt: attachments.createdAt,
          uploadedById: attachments.uploadedById,
          uploadedByName: users.name,
        })
        .from(attachments)
        .leftJoin(users, eq(attachments.uploadedById, users.id))
        .where(eq(attachments.ticketId, id))
        .orderBy(asc(attachments.createdAt)),
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

  return {
    ticket,
    checklist,
    comments: ticketComments,
    attachments: ticketAttachments,
    assignee,
    allUsers,
  };
}

// ─── Create ticket ────────────────────────────────────────────────────────────
export async function createTicket(data: unknown) {
  const { userId, role } = await requireAnyRole();
  const parsed = CreateTicketSchema.parse(data);

  // Team members can only create tickets assigned to themselves; privileged
  // roles may assign to anyone (or leave unassigned).
  const assigneeId = isPrivilegedRole(role)
    ? parsed.assigneeId ?? null
    : userId;

  const [ticket] = await db
    .insert(tickets)
    .values({
      ...parsed,
      assigneeId,
      creatorId: userId,
      deadline: parsed.deadline ? new Date(parsed.deadline) : null,
    })
    .returning();

  revalidatePath("/tasks");
  revalidatePath("/team-board");
  return ticket;
}

// ─── Update ticket ────────────────────────────────────────────────────────────
export async function updateTicket(id: string, data: unknown) {
  const { userId, role } = await requireAnyRole();
  await assertTicketAccess(id, userId, role);
  const parsed = UpdateTicketSchema.parse(data);

  // Team members cannot reassign a ticket away from themselves.
  const { assigneeId, ...rest } = parsed;
  const setValues = isPrivilegedRole(role) ? parsed : rest;

  const [ticket] = await db
    .update(tickets)
    .set({
      ...setValues,
      deadline: parsed.deadline ? new Date(parsed.deadline) : null,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id))
    .returning();

  revalidatePath("/tasks");
  revalidatePath("/team-board");
  return ticket;
}

// ─── Update ticket status ─────────────────────────────────────────────────────
export async function updateTicketStatus(id: string, data: unknown) {
  const { userId, role } = await requireAnyRole();
  await assertTicketAccess(id, userId, role);
  const parsed = UpdateStatusSchema.parse(data);

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
  revalidatePath("/team-board");
  return ticket;
}

// ─── Delete ticket ────────────────────────────────────────────────────────────
export async function deleteTicket(id: string) {
  const { userId, role } = await requireAnyRole();
  await assertTicketAccess(id, userId, role);

  await db.delete(tickets).where(eq(tickets.id, id));

  revalidatePath("/tasks");
  revalidatePath("/team-board");
}
