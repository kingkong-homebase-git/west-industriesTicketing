import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = {
    name: session.user?.name ?? "Unknown",
    role: ((session.user as any)?.role as string) ?? "team_member",
    email: session.user?.email ?? "",
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      <Sidebar role={user.role} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
