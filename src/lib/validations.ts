import { z } from "zod";

// ─── Ticket ───────────────────────────────────────────────────────────────────
export const CreateTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assigneeId: z.string().uuid().optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  status: z
    .enum(["open", "in_progress", "review", "done", "closed"])
    .default("open"),
});

export const UpdateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  status: z
    .enum(["open", "in_progress", "review", "done", "closed"])
    .optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "review", "done", "closed"]),
  sortOrder: z.number().int().default(0),
});

// ─── Checklist ────────────────────────────────────────────────────────────────
export const AddChecklistItemSchema = z.object({
  ticketId: z.string().uuid(),
  label: z.string().min(1).max(500),
});

export const ReorderChecklistSchema = z.object({
  ticketId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()),
});

// ─── Comment ──────────────────────────────────────────────────────────────────
export const AddCommentSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

// ─── User ─────────────────────────────────────────────────────────────────────
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["super_user", "team_member"]).default("team_member"),
});
