/**
 * SLA reminder worker. Finds active tasks whose deadline is within the next 24
 * hours and that haven't been reminded yet, emails the assignee + admins, and
 * stamps notified_sla=true so each task is only reminded once (until its
 * deadline changes, which re-arms the flag in updateTicket).
 *
 * Run on a schedule via PM2 (see ecosystem.config.js → west-industries-sla).
 * Loads .env.local itself (dotenv) so it works as a standalone process.
 */
import postgres from "postgres";
import * as dotenv from "dotenv";
// Relative import (no "@" alias) so tsx resolves it without tsconfig paths.
import { sendTaskNotificationEmail } from "../src/lib/email";

dotenv.config({ path: ".env.local" });

const SLA_WINDOW_HOURS = 24;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const sql = postgres(connectionString, { max: 1 });
  const appUrl = process.env.AUTH_URL || "http://localhost:3000";

  try {
    // Tasks due within the window, still active, not yet reminded.
    const due = await sql<
      {
        id: string;
        title: string;
        deadline: Date;
        assignee_name: string | null;
        assignee_email: string | null;
      }[]
    >`
      SELECT t.id, t.title, t.deadline,
             u.name AS assignee_name, u.email AS assignee_email
      FROM tickets t
      LEFT JOIN users u ON t.assignee_id = u.id AND u.is_archived = false
      WHERE t.deadline IS NOT NULL
        AND t.deadline > now()
        AND t.deadline <= now() + make_interval(hours => ${SLA_WINDOW_HOURS})
        AND t.status NOT IN ('accomplished', 'failed')
        AND t.notified_sla = false
    `;

    if (due.length === 0) {
      console.log("[sla] No tasks due within 24h need reminding.");
      return;
    }

    // Admins / super users (active) get reminded too.
    const admins = await sql<{ name: string; email: string }[]>`
      SELECT name, email FROM users
      WHERE role IN ('super_user', 'admin') AND is_archived = false
    `;

    let sent = 0;
    const notifiedIds: string[] = [];

    for (const task of due) {
      // Build a unique recipient set: assignee + admins.
      const recipients = new Map<string, string | null>();
      if (task.assignee_email) recipients.set(task.assignee_email, task.assignee_name);
      for (const a of admins) if (a.email) recipients.set(a.email, a.name);

      if (recipients.size === 0) {
        // Nobody to email, but still mark it so we don't re-check forever.
        notifiedIds.push(task.id);
        continue;
      }

      const deadlineStr = new Date(task.deadline).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      await Promise.all(
        [...recipients.entries()].map(([email, recipientName]) =>
          sendTaskNotificationEmail({
            toEmail: email,
            recipientName,
            subject: `⏰ Due soon: ${task.title}`,
            heading: "A task is due within 24 hours",
            intro: `This task is approaching its deadline${
              task.assignee_name ? ` (assigned to ${task.assignee_name})` : ""
            }.`,
            taskTitle: task.title,
            taskMeta: `Due ${deadlineStr}`,
            ctaUrl: `${appUrl}/team-board`,
            ctaLabel: "View on the board",
            accent: "#f59e0b",
          })
        )
      );

      sent += recipients.size;
      notifiedIds.push(task.id);
    }

    if (notifiedIds.length > 0) {
      await sql`UPDATE tickets SET notified_sla = true WHERE id = ANY(${sql.array(
        notifiedIds
      )}::uuid[])`;
    }

    console.log(
      `[sla] Reminded ${notifiedIds.length} task(s), ${sent} email(s) sent.`
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[sla] worker failed:", err);
  process.exit(1);
});
