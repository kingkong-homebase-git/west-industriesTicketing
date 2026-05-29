"use client";

import { useState } from "react";
import { format } from "date-fns";
import { archiveUser, restoreUser, resendInvite, cancelInvite, getInviteLink, deleteUser } from "@/actions/users";
import { toast } from "sonner";
import InviteUserDialog from "./InviteUserDialog";
import RoleBadge from "@/components/layout/RoleBadge";
import { cn } from "@/lib/utils";
import { RefreshCw, XCircle, Archive, RotateCcw, ShieldCheck, Link2, Trash2 } from "lucide-react";

interface TeamTableProps {
  initialUsers: any[];
  initialInvites: any[];
}

export default function TeamTable({ initialUsers, initialInvites }: TeamTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [invites, setInvites] = useState(initialInvites);

  const handleArchive = async (userId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to archive this user? They will no longer be able to log in or be assigned new tickets."
      )
    ) {
      return;
    }

    try {
      await archiveUser(userId);
      setUsers(users.map((u) => (u.id === userId ? { ...u, isArchived: true } : u)));
      toast.success("User archived successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to archive user.");
    }
  };

  const handleRestore = async (userId: string) => {
    try {
      await restoreUser(userId);
      setUsers(users.map((u) => (u.id === userId ? { ...u, isArchived: false } : u)));
      toast.success("User restored successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to restore user.");
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (
      !window.confirm(
        `Permanently delete ${name}? This CANNOT be undone. Their tickets are kept but become unassigned, and any invites they sent are removed.`
      )
    ) {
      return;
    }

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
      toast.success("User permanently deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user.");
    }
  };

  const handleResend = async (inviteId: string) => {
    try {
      const res = await resendInvite(inviteId);
      if (!res.ok) {
        toast.error(res.error || "Failed to resend invitation.");
        return;
      }
      if (res.emailDelivered) {
        toast.success("Invitation resent successfully.");
      } else {
        let copied = false;
        try {
          await navigator.clipboard.writeText(res.inviteLink || "");
          copied = true;
        } catch {}
        toast.warning(
          copied
            ? "Invitation resent, but email failed. The invite link has been copied to your clipboard."
            : "Invitation resent, but email failed. Use 'Copy link' to copy the invite link."
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invitation.");
    }
  };

  const handleCopyLink = async (inviteId: string) => {
    try {
      const link = await getInviteLink(inviteId);
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied to clipboard.");
    } catch (err: any) {
      toast.error(err.message || "Failed to copy invite link.");
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!window.confirm("Are you sure you want to cancel this invitation?")) {
      return;
    }

    try {
      await cancelInvite(inviteId);
      setInvites(invites.filter((i) => i.id !== inviteId));
      toast.success("Invitation cancelled successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel invitation.");
    }
  };

  // Combine both users and invites into a unified rows array sorted by name
  const combinedRows = [
    ...users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.isArchived ? ("archived" as const) : ("active" as const),
      createdAt: u.createdAt,
      type: "user" as const,
    })),
    ...invites.map((i) => ({
      id: i.id,
      name: i.name,
      email: i.email,
      role: i.role,
      status: "pending" as const,
      createdAt: i.createdAt,
      type: "invite" as const,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const totalMembers = combinedRows.length;

  const statusBadge = (status: "active" | "archived" | "pending") => {
    if (status === "archived")
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-danger/10 border border-danger/20 text-danger">
          Archived
        </span>
      );
    if (status === "active")
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 border border-success/30 text-success shadow-[0_0_10px_rgba(34,197,94,0.05)]">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Active
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/15 border border-warning/30 text-warning">
        Pending Invite
      </span>
    );
  };

  const rowActions = (row: (typeof combinedRows)[number]) => {
    const isArchived = row.status === "archived";
    const isPending = row.status === "pending";
    const isActive = row.status === "active";
    const protectedAdmin = row.email === "admin@westindustries.com";
    const btn = "flex items-center gap-1 text-xs font-bold transition-all px-2.5 py-1.5 rounded-lg cursor-pointer border";
    return (
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {isPending && (
          <>
            <button onClick={() => handleCopyLink(row.id)} title="Copy invite link" className={cn(btn, "text-text-secondary hover:text-text-primary bg-surface-2/40 border-border/60")}>
              <Link2 size={12} /> Copy link
            </button>
            <button onClick={() => handleResend(row.id)} title="Resend invitation email" className={cn(btn, "text-accent hover:text-accent-hover bg-accent/10 border-accent/20")}>
              <RefreshCw size={12} /> Resend
            </button>
            <button onClick={() => handleCancelInvite(row.id)} title="Cancel invitation" className={cn(btn, "text-danger hover:text-danger-hover bg-danger/10 border-danger/20")}>
              <XCircle size={12} /> Cancel
            </button>
          </>
        )}
        {isActive && !protectedAdmin && (
          <button onClick={() => handleArchive(row.id)} title="Archive user" className={cn(btn, "text-danger hover:text-danger-hover bg-danger/10 border-danger/20")}>
            <Archive size={12} /> Archive
          </button>
        )}
        {isArchived && (
          <button onClick={() => handleRestore(row.id)} title="Restore user" className={cn(btn, "text-success hover:text-success-hover bg-success/10 border-success/20")}>
            <RotateCcw size={12} /> Restore
          </button>
        )}
        {(isActive || isArchived) && !protectedAdmin && (
          <button onClick={() => handleDelete(row.id, row.name)} title="Permanently delete user" className={cn(btn, "text-danger hover:text-danger-hover bg-danger/10 border-danger/30")}>
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full text-text-primary">
      {/* Table Sub-header */}
      <div className="p-4 border-b border-border/40 flex justify-between items-center bg-surface-2/10 backdrop-blur-md">
        <div className="text-sm font-medium text-text-secondary">
          {totalMembers} total member{totalMembers === 1 ? "" : "s"}
        </div>
        <InviteUserDialog onInviteSent={(newInvite) => setInvites([...invites, newInvite])} />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block flex-1 overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm border-collapse">
          <thead className="bg-surface-2/20 backdrop-blur-md sticky top-0 z-10">
            <tr className="border-b border-border/40">
              <th className="px-6 py-3.5 font-semibold text-text-secondary tracking-wider">Name</th>
              <th className="px-6 py-3.5 font-semibold text-text-secondary tracking-wider">Email Address</th>
              <th className="px-6 py-3.5 font-semibold text-text-secondary tracking-wider">Role</th>
              <th className="px-6 py-3.5 font-semibold text-text-secondary tracking-wider">Status</th>
              <th className="px-6 py-3.5 font-semibold text-text-secondary tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {combinedRows.map((row) => {
              const isArchived = row.status === "archived";

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-surface-2/10 transition-all duration-200",
                    isArchived && "opacity-50 bg-surface-2/5"
                  )}
                >
                  {/* Name */}
                  <td className="px-6 py-4.5 font-medium text-text-primary">
                    <div className="flex items-center gap-2">
                      <span className={cn(isArchived && "line-through text-text-secondary")}>
                        {row.name}
                      </span>
                      {row.email === "admin@westindustries.com" && (
                        <ShieldCheck size={14} className="text-accent filter drop-shadow-[0_0_4px_rgba(249,115,22,0.4)]" />
                      )}
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-4.5 text-text-secondary font-mono text-xs">{row.email}</td>

                  {/* Role */}
                  <td className="px-6 py-4.5">
                    <RoleBadge role={row.role} />
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4.5">{statusBadge(row.status)}</td>

                  {/* Actions column */}
                  <td className="px-6 py-4.5">{rowActions(row)}</td>
                </tr>
              );
            })}
            {combinedRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-secondary italic">
                  No workspace members or pending invites found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex-1 overflow-auto p-3 space-y-3">
        {combinedRows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "rounded-2xl border border-border/60 bg-surface/40 backdrop-blur-md p-4",
              row.status === "archived" && "opacity-60"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold text-text-primary truncate",
                      row.status === "archived" && "line-through text-text-secondary"
                    )}
                  >
                    {row.name}
                  </span>
                  {row.email === "admin@westindustries.com" && (
                    <ShieldCheck size={14} className="text-accent shrink-0" />
                  )}
                </div>
                <div className="text-xs text-text-secondary font-mono truncate">{row.email}</div>
              </div>
              {statusBadge(row.status)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <RoleBadge role={row.role} />
            </div>
            <div className="mt-3">{rowActions(row)}</div>
          </div>
        ))}
        {combinedRows.length === 0 && (
          <p className="text-center text-text-secondary italic py-12">
            No workspace members or pending invites found.
          </p>
        )}
      </div>
    </div>
  );
}
