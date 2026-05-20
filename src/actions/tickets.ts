"use server";

import { db } from "@/db";
import { tickets, checklistItems, comments, users } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { requireAnyRole, isPrivilegedRole } from "@/lib/require-role";
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  UpdateStatusSchema,
} from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { pushTicketToNotion, archiveNotionPage } from "@/lib/sync/push";
import { debouncePush } from "@/lib/sync/debounce";

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

// Team members may only act on tickets they own (assigned to or created by
// them). Privileged roles (super_user/admin) may act on any ticket. Throws if a
// team member targets someone else's ticket.
async function assertTicketAccess(
  ticketId: string,
  userId: string,
  role: string
): Promise<void> {
  if (isPrivilegedRole(role)) return;

  const [t] = await db
    .select({ assigneeId: tickets.assigneeId, creatorId: tickets.creatorId })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!t) throw new Error("Ticket not found");
  if (t.assigneeId !== userId && t.creatorId !== userId) {
    throw new Error("Forbidden: you can only modify your own tickets");
  }
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

  // Synchronous push on create so we have the notion_page_id before returning.
  await pushTicketToNotion(ticket.id);

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

  debouncePush(id, () => pushTicketToNotion(id));

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

  debouncePush(id, () => pushTicketToNotion(id));

  revalidatePath("/tasks");
  revalidatePath("/team-board");
  return ticket;
}

// ─── Delete ticket ────────────────────────────────────────────────────────────
export async function deleteTicket(id: string) {
  const { userId, role } = await requireAnyRole();
  await assertTicketAccess(id, userId, role);

  // Capture the notion_page_id before deletion so we can archive the
  // remote page after the local row is gone.
  const [existing] = await db
    .select({ notionPageId: tickets.notionPageId })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1);

  await db.delete(tickets).where(eq(tickets.id, id));

  if (existing?.notionPageId) {
    void archiveNotionPage(existing.notionPageId, id);
  }

  revalidatePath("/tasks");
  revalidatePath("/team-board");
}
