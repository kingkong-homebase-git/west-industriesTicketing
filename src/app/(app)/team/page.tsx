import { auth } from "@/auth";
import { db } from "@/db";
import { users, invites } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import TeamTable from "@/components/team/TeamTable";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "super_user" && role !== "admin") {
    redirect("/tasks");
  }

  // 1. Fetch all users from the DB
  const allUsers = await db.select().from(users).orderBy(users.name);

  // 2. Fetch all pending invites from the DB
  const pendingInvites = await db
    .select()
    .from(invites)
    .where(eq(invites.isAccepted, false))
    .orderBy(invites.name);

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary">Team Management</h1>
        <p className="text-sm text-text-secondary">
          Manage your team members and their roles.
        </p>
      </div>

      <div className="flex-1 overflow-hidden bg-surface/30 backdrop-blur-md rounded-2xl border border-border/60 shadow-xl flex flex-col hover:border-accent/20 transition-all duration-300">
        <TeamTable initialUsers={allUsers} initialInvites={pendingInvites} />
      </div>
    </div>
  );
}
