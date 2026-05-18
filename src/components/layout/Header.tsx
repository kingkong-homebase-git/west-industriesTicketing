"use client";

import { signOut } from "next-auth/react";
import RoleBadge from "./RoleBadge";
import { LogOut } from "lucide-react";

interface HeaderProps {
  user: { name: string; role: string; email: string };
}

export default function Header({ user }: HeaderProps) {
  return (
    <header
      className="h-14 flex items-center justify-between px-6 border-b shrink-0"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
          <span className="text-white font-bold text-sm">W</span>
        </div>
        <span className="font-bold text-base tracking-tight text-text-primary">
          West Industries
        </span>
      </div>

      {/* User info */}
      <div className="flex items-center gap-3">
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
