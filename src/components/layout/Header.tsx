"use client";

import { signOut } from "next-auth/react";
import RoleBadge from "./RoleBadge";
import { BrandLogo } from "@/components/brand/Logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { LogOut, Menu } from "lucide-react";

interface HeaderProps {
  user: { name: string; role: string; email: string };
  onMenuClick?: () => void;
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  return (
    <header
      className="h-16 flex items-center justify-between px-4 sm:px-6 border-b shrink-0"
      style={{
        background: "rgba(14, 19, 32, 0.20)",
        backdropFilter: "blur(10px)",
        borderColor: "var(--border)",
      }}
    >
      {/* Hamburger (mobile) + wordmark */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2/50 transition-colors"
          title="Open menu"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        {/* Mobile only — on desktop the sidebar shows the brand, so this would
            be a duplicate sitting beside it. */}
        <BrandLogo size={26} textClassName="text-base" className="md:hidden" />
      </div>

      {/* User info */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <span className="text-sm text-text-secondary hidden sm:block">
          {user.name}
        </span>
        <RoleBadge role={user.role} />
        <button
          id="sign-out-btn"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-md hover:bg-surface-2"
          title="Sign out"
        >
          <LogOut size={15} />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  );
}
