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
    <div className="relative z-10 flex h-full w-full overflow-hidden">
      <Sidebar
        role={role}
        projects={projects}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={toggleCollapse}
      />
      <div className="relative flex flex-col flex-1 min-w-0">
        <Header user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
