"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { X, ChevronDown, Check, UserPlus } from "lucide-react";
import { inviteUser } from "@/actions/users";
import { toast } from "sonner";
import { InviteUserSchema } from "@/lib/validations";

interface InviteUserDialogProps {
  onInviteSent: (invite: any) => void;
}

export default function InviteUserDialog({ onInviteSent }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "team_member" as any,
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = InviteUserSchema.safeParse({
      name: formData.name,
      email: formData.email,
      role: formData.role,
      message: formData.message || null,
    });

    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      const firstErr = Object.values(errs).flat()[0];
      toast.error(firstErr as string);
      return;
    }

    setLoading(true);
    try {
      const result = await inviteUser(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.emailDelivered) {
        toast.success("Invite sent successfully.");
      } else {
        let copied = false;
        try {
          await navigator.clipboard.writeText(result.invite.inviteLink);
          copied = true;
        } catch {
          copied = false;
        }
        toast.warning(
          copied
            ? "Invite created — email couldn't be delivered, so the invite link was copied to your clipboard. Share it manually."
            : "Invite created, but the email could not be delivered. Use 'Copy link' in the pending invites list to share it manually.",
          { duration: 9000 }
        );
      }
      onInviteSent(result.invite);
      setOpen(false);
      setFormData({ name: "", email: "", role: "team_member", message: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_14px_rgba(249,115,22,0.2)] hover:shadow-[0_4px_20px_rgba(249,115,22,0.4)] cursor-pointer">
          <UserPlus size={16} />
          Invite User
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface/30 backdrop-blur-2xl border border-border/60 shadow-2xl rounded-2xl z-50 flex flex-col focus:outline-none overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/40 bg-surface-2/10">
            <Dialog.Title className="text-lg font-bold text-text-primary">
              Invite Team Member
            </Dialog.Title>
            <Dialog.Close className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2/40 transition-all cursor-pointer">
              <X size={18} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Full Name</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className="w-full bg-surface-2/40 backdrop-blur-sm border border-border/60 text-text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent hover:bg-surface-2/60 focus:bg-surface-2/60 transition-all"
              />
            </div>
            
            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Email Address</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full bg-surface-2/40 backdrop-blur-sm border border-border/60 text-text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent hover:bg-surface-2/60 focus:bg-surface-2/60 transition-all"
              />
            </div>

            {/* Role selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</label>
              <Select.Root
                value={formData.role}
                onValueChange={(val: any) => setFormData({ ...formData, role: val })}
              >
                <Select.Trigger className="flex items-center justify-between w-full bg-surface-2/40 backdrop-blur-sm border border-border/60 text-text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent hover:bg-surface-2/60 focus:bg-surface-2/60 transition-all cursor-pointer">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown size={16} className="text-text-secondary" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface/90 backdrop-blur-2xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-[60] min-w-[200px]">
                    <Select.Viewport className="p-1">
                      <Select.Item value="team_member" className="flex items-center px-8 py-2.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded-lg cursor-pointer outline-none select-none relative transition-colors">
                        <Select.ItemText>Team Member</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2.5">
                          <Check size={14} className="text-accent" />
                        </Select.ItemIndicator>
                      </Select.Item>
                      <Select.Item value="admin" className="flex items-center px-8 py-2.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded-lg cursor-pointer outline-none select-none relative transition-colors">
                        <Select.ItemText>Admin</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2.5">
                          <Check size={14} className="text-accent" />
                        </Select.ItemIndicator>
                      </Select.Item>
                      <Select.Item value="super_user" className="flex items-center px-8 py-2.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded-lg cursor-pointer outline-none select-none relative transition-colors">
                        <Select.ItemText>Super User</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2.5">
                          <Check size={14} className="text-accent" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Optional Personal Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Personal Message (Optional)</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Write a message to include in the email..."
                rows={3}
                className="w-full bg-surface-2/40 backdrop-blur-sm border border-border/60 text-text-primary rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent hover:bg-surface-2/60 focus:bg-surface-2/60 transition-all resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-4 flex justify-end gap-3 border-t border-border/40 mt-6 bg-surface-2/5">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-[0_4px_14px_rgba(249,115,22,0.2)] hover:shadow-[0_4px_20px_rgba(249,115,22,0.4)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
