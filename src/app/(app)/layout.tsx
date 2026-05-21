import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

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
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Background Image with Premium Atmospheric Glassmorphism Overlay */}
      <div
        className="app-bg-image absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url('/mountiankanban.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="app-bg-overlay absolute inset-0 z-0 backdrop-blur-[1px] pointer-events-none" />
      
      <AppShell role={user.role} user={user}>
        {children}
      </AppShell>
    </div>
  );
}
