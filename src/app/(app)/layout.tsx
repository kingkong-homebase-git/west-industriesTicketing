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
    <div className="relative flex h-screen overflow-hidden bg-background">
      {/* Background Image with Premium Atmospheric Glassmorphism Overlay */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url('/mountiankanban.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.40,
        }}
      />
      <div 
        className="absolute inset-0 z-0 backdrop-blur-[1px] pointer-events-none" 
        style={{
          backgroundColor: "rgba(5, 7, 13, 0.55)"
        }}
      />
      
      <div className="relative z-10 flex h-full w-full overflow-hidden">
        <Sidebar role={user.role} />
        <div className="relative flex flex-col flex-1 min-w-0">
          <Header user={user} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
