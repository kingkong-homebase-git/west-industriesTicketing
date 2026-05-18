"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Users, KanbanSquare, Layers, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: string;
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r bg-surface/30 backdrop-blur-xl border-border">
      <div className="h-16 flex items-center px-6 border-b border-border bg-surface-2/10">
        <div className="flex items-center gap-2.5 text-text-primary font-bold text-lg tracking-tight">
          <Layers className="text-accent filter drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" size={20} />
          <span className="bg-gradient-to-r from-text-primary via-text-primary to-accent bg-clip-text text-transparent">
            West Industries
          </span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        <div>
          <h4 className="px-3 text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-3">Overview</h4>
          <div className="space-y-1.5">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent",
                pathname === "/dashboard"
                  ? "bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2/50"
              )}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} className={pathname === "/dashboard" ? "text-accent" : "text-text-secondary"} />
                Dashboard
              </div>
            </Link>

            <Link
              href="/tasks"
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent",
                pathname.startsWith("/tasks")
                  ? "bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2/50"
              )}
            >
              <div className="flex items-center gap-3">
                <CheckSquare size={18} className={pathname.startsWith("/tasks") ? "text-accent" : "text-text-secondary"} />
                My Tasks
              </div>
            </Link>
            
            {(role === "super_user" || role === "admin") && (
              <>
                <Link
                  href="/team-board"
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent",
                    pathname.startsWith("/team-board")
                      ? "bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <KanbanSquare size={18} className={pathname.startsWith("/team-board") ? "text-accent" : "text-text-secondary"} />
                    Team Tasks
                  </div>
                </Link>
                <Link
                  href="/team"
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent",
                    pathname === "/team"
                      ? "bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-semibold"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} className={pathname === "/team" ? "text-accent" : "text-text-secondary"} />
                    Team
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-border bg-surface-2/5">
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-text-secondary/50 font-mono tracking-wider">
            v1.0.0
          </div>
          <div className="bg-surface-2/20 backdrop-blur-md px-3 py-2.5 rounded-xl border border-border shadow-[0_0_15px_rgba(59,130,246,0.02)]">
            <div className="text-[9px] text-accent uppercase font-bold tracking-widest">
              Access level
            </div>
            <div className="text-xs font-bold text-text-primary mt-1 capitalize tracking-wide">
              {role.replace("_", " ")}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
