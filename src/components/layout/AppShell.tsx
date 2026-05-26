"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface AppShellProps {
  role: string;
  user: { name: string; role: string; email: string };
  projects: { id: string; name: string; color: string | null }[];
  children: React.ReactNode;
}

export default function AppShell({ role, user, projects, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the desktop collapsed preference.
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "1") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    // Sidebar + content are two floating panels on the same background, with
    // equal margins all around and an equal gutter between them.
    <div className="relative z-10 flex h-full w-full overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
      <Sidebar
        role={role}
        projects={projects}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={toggleCollapse}
      />
      {/* Header + board: one rounded panel matching the sidebar panel. */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden rounded-2xl border border-border shadow-xl bg-background/90 backdrop-blur-md">
        <Header user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
