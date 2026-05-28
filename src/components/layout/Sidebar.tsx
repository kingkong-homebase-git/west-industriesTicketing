"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckSquare,
  Users,
  KanbanSquare,
  LayoutDashboard,
  Folder,
  Star,
  CalendarDays,
  Sparkles,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createProject } from "@/actions/projects";
import { HemisphereMark } from "@/components/brand/Logo";

interface Project {
  id: string;
  name: string;
  color: string | null;
}

interface SidebarProps {
  role: string;
  projects: Project[];
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

export default function Sidebar({ role, projects, collapsed, mobileOpen, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isPrivileged = role === "super_user" || role === "admin";

  const handleAddProject = async () => {
    const name = window.prompt("New project name:");
    if (!name || !name.trim()) return;
    try {
      const res = await createProject({ name: name.trim() });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Project "${res.project.name}" created.`);
      router.refresh();
    } catch {
      toast.error("Failed to create project.");
    }
  };

  const overview: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "My Tasks", icon: CheckSquare },
    { href: "/priority", label: "Priority", icon: Star },
    { href: "/team-board", label: "Team Tasks", icon: KanbanSquare },
    ...(isPrivileged ? [{ href: "/team", label: "Team", icon: Users }] : []),
    ...(isPrivileged ? [{ href: "/settings", label: "Jacques Calendar", icon: CalendarDays }] : []),
    { href: "/whats-new", label: "What's New", icon: Sparkles },
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

      {/* Projects (dynamic) */}
      <div>
        {showLabel && (
          <div className="px-3 mb-3 flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-accent/80 uppercase tracking-widest">Projects</h4>
            {isPrivileged && (
              <button onClick={handleAddProject} title="Add project" className="text-text-secondary hover:text-accent transition-colors">
                <Plus size={14} />
              </button>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          {projects.map((p) => {
            const href = `/projects/${p.id}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={p.id}
                href={href}
                onClick={onNavigate}
                title={showLabel ? undefined : p.name}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-transparent",
                  !showLabel && "justify-center",
                  active
                    ? "bg-accent/10 text-accent border-accent/20 font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-2/50"
                )}
              >
                <Folder size={18} className={cn("shrink-0", active ? "text-accent" : "text-text-secondary")} />
                {showLabel && <span className="truncate">{p.name}</span>}
              </Link>
            );
          })}
          {showLabel && projects.length === 0 && (
            <p className="px-3 text-xs text-text-secondary/70 italic">No projects yet.</p>
          )}
          {/* collapsed-rail add button */}
          {!showLabel && isPrivileged && (
            <button
              onClick={handleAddProject}
              title="Add project"
              className="flex items-center justify-center w-full px-3 py-2.5 rounded-xl text-text-secondary hover:text-accent hover:bg-surface-2/50 transition-colors"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  // Transparent (no own background, no border) so the logo area shows the same
  // board background as the header and merges into it as one continuous bar.
  const Brand = ({ showLabel }: { showLabel: boolean }) => (
    <div
      className={cn("h-16 flex items-center", showLabel ? "px-5" : "justify-center px-0")}
    >
      <div className="flex items-center gap-2.5 text-text-primary font-bold text-xl tracking-tight">
        <HemisphereMark size={34} className="shrink-0" />
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
          "hidden md:flex shrink-0 flex-col overflow-hidden rounded-2xl border border-border shadow-xl bg-background/90 backdrop-blur-md transition-[width] duration-300",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <Brand showLabel={!collapsed} />
        {/* Transparent so the whole panel is one uniform colour, matching the
            content panel exactly. */}
        <div className="flex-1 flex flex-col min-h-0">
          <NavBody showLabel={!collapsed} />
          <div className="p-3 border-t border-border">
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
