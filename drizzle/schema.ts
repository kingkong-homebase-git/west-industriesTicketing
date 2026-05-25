import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "super_user",
  "admin",
  "team_member",
]);
// Mirrors the Notion "Status" select options exactly (Notion is source of truth).
export const ticketStatusEnum = pgEnum("ticket_status", [
  "not_started",
  "on_track",
  "behind",
  "at_risk",
  "reprioritized",
  "accomplished",
  "failed",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("team_member"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").unique().notNull(),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Tickets ──────────────────────────────────────────────────────────────────
// Note: creator_id is nullable in DB so ON DELETE SET NULL works correctly.
// The application layer (Zod + server actions) enforces it is always provided on create.
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    status: ticketStatusEnum("status").notNull().default("not_started"),
    priority: ticketPriorityEnum("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    creatorId: uuid("creator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    deadline: timestamp("deadline", { withTimezone: true }),
    deadlineEnd: timestamp("deadline_end", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    // legacy free-text project (kept for back-compat); structured project below
    project: text("project"),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    expectedResults: text("expected_results"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tickets_status_idx").on(t.status),
    index("tickets_assignee_idx").on(t.assigneeId),
    index("tickets_status_sort_idx").on(t.status, t.sortOrder),
  ]
);

// ─── Checklist Items ──────────────────────────────────────────────────────────
export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("checklist_ticket_idx").on(t.ticketId)]
);

// ─── Comments ─────────────────────────────────────────────────────────────────
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("comments_ticket_idx").on(t.ticketId)]
);

// ─── Invites ──────────────────────────────────────────────────────────────────
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").unique().notNull(),
    role: userRoleEnum("role").notNull().default("team_member"),
    token: text("token").unique().notNull(),
    message: text("message"),
    invitedById: uuid("invited_by_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    isAccepted: boolean("is_accepted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("invites_email_idx").on(t.email)]
);

export const invitesRelations = relations(invites, ({ one }) => ({
  invitedBy: one(users, {
    fields: [invites.invitedById],
    references: [users.id],
  }),
}));

// ─── Password Resets ────────────────────────────────────────────────────────
export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("password_resets_token_idx").on(t.token)]
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  assignedTickets: many(tickets, { relationName: "assignee" }),
  createdTickets: many(tickets, { relationName: "creator" }),
  comments: many(comments),
  sentInvites: many(invites),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  creator: one(users, {
    fields: [tickets.creatorId],
    references: [users.id],
    relationName: "creator",
  }),
  checklistItems: many(checklistItems),
  comments: many(comments),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  ticket: one(tickets, {
    fields: [checklistItems.ticketId],
    references: [tickets.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [comments.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type UserRole = "super_user" | "admin" | "team_member";
export type TicketStatus =
  | "not_started"
  | "on_track"
  | "behind"
  | "at_risk"
  | "reprioritized"
  | "accomplished"
  | "failed";
export type TicketPriority = "low" | "medium" | "high";
