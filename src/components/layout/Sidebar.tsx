"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Users, KanbanSquare, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: string;
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r bg-surface border-border">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-text-primary font-bold text-xl tracking-tight">
          <Layers className="text-accent" />
          West Industries
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        <div>
          <h4 className="px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Overview</h4>
          <div className="space-y-1">
            <Link
              href="/tasks"
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                pathname.startsWith("/tasks")
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
              )}
            >
              <div className="flex items-center gap-3">
                <CheckSquare size={18} />
                Tasks
              </div>
            </Link>
            
            {role === "super_user" && (
              <>
                <Link
                  href="/team"
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    pathname === "/team"
                      ? "bg-accent text-white shadow-md shadow-accent/20"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} />
                    Team Roster
                  </div>
                </Link>
                <Link
                  href="/team-board"
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    pathname.startsWith("/team-board")
                      ? "bg-accent text-white shadow-md shadow-accent/20"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <KanbanSquare size={18} />
                    Team Board
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="p-6 border-t border-border">
        <div className="bg-surface-2 rounded-xl p-4 relative overflow-hidden group border border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-xs text-text-secondary mb-1">Role</p>
          <p className="text-sm font-semibold text-text-primary capitalize">{role.replace("_", " ")}</p>
        </div>
      </div>
    </aside>
  );
}
