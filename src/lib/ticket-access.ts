import { db } from "@/db";
import { tickets } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { isPrivilegedRole } from "@/lib/require-role";

// Team members may only act on tickets they own (assigned to or created by
// them). Privileged roles (super_user/admin) may act on any ticket. Throws if a
// team member targets someone else's ticket.
export async function assertTicketAccess(
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
