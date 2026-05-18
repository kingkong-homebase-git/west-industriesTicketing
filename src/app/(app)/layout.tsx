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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={user.role} />
      <div className="relative flex flex-col flex-1 min-w-0">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 z-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: "url('/mountiankanban.jpeg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="absolute inset-0 z-0 bg-background/85 backdrop-blur-[2px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col flex-1 h-full">
          <Header user={user} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
