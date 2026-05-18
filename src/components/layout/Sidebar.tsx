"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  role: string;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const items =
    role === "super_user"
      ? [...navItems, { href: "/team", label: "Team", icon: Users }]
      : navItems;

  return (
    <aside
      className="w-56 shrink-0 flex flex-col border-r"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <nav className="flex-1 p-3 space-y-0.5 mt-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              id={`nav-${label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div
        className="p-4 border-t text-xs text-text-secondary"
        style={{ borderColor: "var(--border)" }}
      >
        v1.0.0
      </div>
    </aside>
  );
}
