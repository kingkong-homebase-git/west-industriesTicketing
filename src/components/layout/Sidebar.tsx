"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  Users,
  KanbanSquare,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HemisphereMark } from "@/components/brand/Logo";

interface SidebarProps {
  role: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export default function Sidebar({ role, collapsed, mobileOpen, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const isPrivileged = role === "super_user" || role === "admin";

  const overview: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "My Tasks", icon: CheckSquare },
    { href: "/team-board", label: "Team Tasks", icon: KanbanSquare },
    ...(isPrivileged ? [{ href: "/team", label: "Team", icon: Users }] : []),
  ];
  // No admin-only nav items currently (Notion sync logs removed).
  const admin: NavItem[] = [];

  const isActive = (href: string) =>
    href === "/team" ? pathname === "/team" : pathname.startsWith(href);

  const NavLink = ({ item, showLabel, onNavigate }: { item: NavItem; showLabel: boolean; onNavigate?: () => void }) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        title={showLabel ? undefined : item.label}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent",
          !showLabel && "justify-center",
          active
            ? "bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(249,115,22,0.15)] font-semibold"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-2/50"
        )}
      >
        <Icon size={18} className={active ? "text-accent shrink-0" : "text-text-secondary shrink-0"} />
        {showLabel && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  // Shared nav body. `showLabel` controls icon-only (collapsed) vs full.
  const NavBody = ({ showLabel, onNavigate }: { showLabel: boolean; onNavigate?: () => void }) => (
    <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
      <div>
        {showLabel && (
          <h4 className="px-3 text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-3">Overview</h4>
        )}
        <div className="space-y-1.5">
          {overview.map((item) => (
            <NavLink key={item.href} item={item} showLabel={showLabel} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
      {admin.length > 0 && (
        <div>
          {showLabel && (
            <h4 className="px-3 text-[10px] font-bold text-accent/80 uppercase tracking-widest mb-3">Admin</h4>
          )}
          <div className="space-y-1.5">
            {admin.map((item) => (
              <NavLink key={item.href} item={item} showLabel={showLabel} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}
    </nav>
  );

  const Brand = ({ showLabel }: { showLabel: boolean }) => (
    <div className={cn("h-16 flex items-center border-b border-border bg-surface-2/10", showLabel ? "px-6" : "justify-center px-0")}>
      <div className="flex items-center gap-2.5 text-text-primary font-bold text-lg tracking-tight">
        <HemisphereMark size={24} className="shrink-0" />
        {showLabel && (
          <span className="bg-gradient-to-r from-text-primary via-text-primary to-accent bg-clip-text text-transparent">
            Hemisphere
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar (collapsible rail) ── */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r bg-surface/30 backdrop-blur-xl border-border transition-[width] duration-300",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <Brand showLabel={!collapsed} />
        <NavBody showLabel={!collapsed} />
        <div className="p-3 border-t border-border bg-surface-2/5">
          {!collapsed && (
            <div className="bg-surface-2/20 backdrop-blur-md px-3 py-2.5 rounded-xl border border-border mb-3">
              <div className="text-[9px] text-accent uppercase font-bold tracking-widest">Access level</div>
              <div className="text-xs font-bold text-text-primary mt-1 capitalize tracking-wide">{role.replace("_", " ")}</div>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-2/50 transition-colors",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* ── Mobile drawer ── */}
      <div className={cn("md:hidden fixed inset-0 z-50", !mobileOpen && "pointer-events-none")}>
        <div
          onClick={onClose}
          className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300", mobileOpen ? "opacity-100" : "opacity-0")}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-72 max-w-[80%] flex flex-col bg-surface/85 backdrop-blur-2xl border-r border-border shadow-2xl transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-surface-2/10">
            <div className="flex items-center gap-2.5 text-text-primary font-bold text-lg tracking-tight">
              <HemisphereMark size={24} className="shrink-0" />
              <span>Hemisphere</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2/50" title="Close">
              <X size={20} />
            </button>
          </div>
          <NavBody showLabel onNavigate={onClose} />
          <div className="p-3 border-t border-border bg-surface-2/5">
            <div className="bg-surface-2/20 px-3 py-2.5 rounded-xl border border-border">
              <div className="text-[9px] text-accent uppercase font-bold tracking-widest">Access level</div>
              <div className="text-xs font-bold text-text-primary mt-1 capitalize tracking-wide">{role.replace("_", " ")}</div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
