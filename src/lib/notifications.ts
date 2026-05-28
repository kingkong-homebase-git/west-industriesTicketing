import { db } from "@/db";
import { users, tickets } from "../../drizzle/schema";
import { and, eq, ne, inArray } from "drizzle-orm";
import { sendTaskNotificationEmail } from "@/lib/email";

function appUrl(path = ""): string {
  const base = process.env.AUTH_URL || "http://localhost:3000";
  return `${base}${path}`;
}

/** Email a single user that a task has been assigned to them. */
export async function notifyTaskAssigned(opts: {
  assigneeId: string;
  taskTitle: string;
  assignedByName: string;
}): Promise<void> {
  const [u] = await db
    .select({ name: users.name, email: users.email, isArchived: users.isArchived })
    .from(users)
    .where(eq(users.id, opts.assigneeId))
    .limit(1);
  if (!u?.email || u.isArchived) return;

  await sendTaskNotificationEmail({
    toEmail: u.email,
    recipientName: u.name,
    subject: `You've been assigned: ${opts.taskTitle}`,
    heading: "A task was assigned to you",
    intro: `${opts.assignedByName} assigned you a task on Hemisphere.`,
    taskTitle: opts.taskTitle,
    ctaUrl: appUrl("/tasks"),
    ctaLabel: "View my tasks",
  });
}

/** Email teammates who were @mentioned in a comment. */
export async function notifyMentioned(opts: {
  userIds: string[];
  ticketId: string;
  commenterName: string;
  snippet: string;
}): Promise<void> {
  if (!opts.userIds.length) return;

  const [task] = await db
    .select({ title: tickets.title })
    .from(tickets)
    .where(eq(tickets.id, opts.ticketId))
    .limit(1);
  const title = task?.title ?? "a task";

  const recipients = await db
    .select({ name: users.name, email: users.email, isArchived: users.isArchived })
    .from(users)
    .where(inArray(users.id, opts.userIds));

  await Promise.all(
    recipients
      .filter((r) => !!r.email && !r.isArchived)
      .map((r) =>
        sendTaskNotificationEmail({
          toEmail: r.email,
          recipientName: r.name,
          subject: `💬 ${opts.commenterName} mentioned you`,
          heading: "You were mentioned in a comment",
          intro: `${opts.commenterName} mentioned you in a comment on a task:`,
          taskTitle: title,
          taskMeta: opts.snippet ? `“${opts.snippet}”` : undefined,
          ctaUrl: appUrl("/tasks"),
          ctaLabel: "View task",
        })
      )
  );
}

/** Email every active member that an Urgent & Important task was created. */
export async function notifyUrgentTaskCreated(opts: {
  taskTitle: string;
  creatorId: string;
  creatorName: string;
}): Promise<void> {
  const recipients = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.isArchived, false), ne(users.id, opts.creatorId)));

  await Promise.all(
    recipients
      .filter((r) => !!r.email)
      .map((r) =>
        sendTaskNotificationEmail({
          toEmail: r.email,
          recipientName: r.name,
          subject: `🔴 Urgent task created: ${opts.taskTitle}`,
          heading: "New urgent & important task",
          intro: `${opts.creatorName} created a task flagged Urgent & Important.`,
          taskTitle: opts.taskTitle,
          taskMeta: "Priority: Urgent & Important",
          ctaUrl: appUrl("/priority"),
          ctaLabel: "Open Priority list",
          accent: "#ef4444",
        })
      )
  );
}
