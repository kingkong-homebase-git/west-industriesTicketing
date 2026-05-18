import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "../../../../drizzle/schema";
import { redirect } from "next/navigation";
import TeamTable from "@/components/team/TeamTable";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "super_user") {
    redirect("/tasks");
  }

  const allUsers = await db.select().from(users).orderBy(users.name);

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary">Team Management</h1>
        <p className="text-sm text-text-secondary">
          Manage your team members and their roles.
        </p>
      </div>

      <div className="flex-1 overflow-hidden bg-surface rounded-xl border border-border shadow-sm flex flex-col">
        <TeamTable initialUsers={allUsers} />
      </div>
    </div>
  );
}
