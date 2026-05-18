"use client";

import { useState } from "react";
import { format } from "date-fns";
import { archiveUser } from "@/actions/users";
import { toast } from "sonner";
import InviteUserDialog from "./InviteUserDialog";
import { cn } from "@/lib/utils";

interface TeamTableProps {
  initialUsers: any[];
}

export default function TeamTable({ initialUsers }: TeamTableProps) {
  const [users, setUsers] = useState(initialUsers);

  const handleArchive = async (userId: string) => {
    if (!window.confirm("Are you sure you want to archive this user? They will no longer be able to log in or be assigned new tickets.")) {
      return;
    }

    try {
      await archiveUser(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, isArchived: true } : u));
      toast.success("User archived");
    } catch (err: any) {
      toast.error(err.message || "Failed to archive user");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/40 flex justify-between items-center bg-white/2">
        <div className="text-sm text-text-secondary">
          {users.length} total members
        </div>
        <InviteUserDialog onUserAdded={(u) => setUsers([...users, u])} />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-white/5 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 font-medium text-text-secondary border-b border-border">Name</th>
              <th className="px-6 py-3 font-medium text-text-secondary border-b border-border">Email</th>
              <th className="px-6 py-3 font-medium text-text-secondary border-b border-border">Role</th>
              <th className="px-6 py-3 font-medium text-text-secondary border-b border-border">Status</th>
              <th className="px-6 py-3 font-medium text-text-secondary border-b border-border text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr
                key={user.id}
                className={cn(
                  "hover:bg-white/5 transition-colors duration-200",
                  user.isArchived && "opacity-60 bg-white/2"
                )}
              >
                <td className="px-6 py-4 font-medium text-text-primary">
                  <span className={cn(user.isArchived && "line-through text-text-secondary")}>
                    {user.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                    user.role === "super_user" ? "bg-accent/10 text-accent border border-accent/20" : "bg-surface/20 text-text-secondary border border-border/40"
                  )}>
                    {user.role === "super_user" ? "Super User" : "Team Member"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.isArchived ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-danger/10 text-danger">
                      Archived
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {!user.isArchived && user.role !== "super_user" && (
                    <button
                      onClick={() => handleArchive(user.id)}
                      className="text-xs font-medium text-danger hover:underline focus:outline-none"
                    >
                      Archive
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-text-secondary italic">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
