"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { X, ChevronDown, Check, UserPlus } from "lucide-react";
import { createUser } from "@/actions/users";
import { toast } from "sonner";
import { CreateUserSchema } from "@/lib/validations";

interface InviteUserDialogProps {
  onUserAdded: (user: any) => void;
}

export default function InviteUserDialog({ onUserAdded }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "team_member" as any,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsed = CreateUserSchema.safeParse(formData);
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      const firstErr = Object.values(errs).flat()[0];
      toast.error(firstErr as string);
      return;
    }

    setLoading(true);
    try {
      const user = await createUser(parsed.data);
      toast.success("User invited successfully");
      onUserAdded(user);
      setOpen(false);
      setFormData({ name: "", email: "", password: "", role: "team_member" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
          <UserPlus size={16} />
          Invite User
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border shadow-2xl rounded-xl z-50 flex flex-col focus:outline-none">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Invite Team Member
            </Dialog.Title>
            <Dialog.Close className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Name</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Must be at least 8 characters"
                className="w-full bg-surface-2 border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Role</label>
              <Select.Root
                value={formData.role}
                onValueChange={(val: any) => setFormData({ ...formData, role: val })}
              >
                <Select.Trigger className="flex items-center justify-between w-full bg-surface-2 border border-border text-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent">
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown size={16} className="text-text-secondary" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="bg-surface-2 border border-border rounded-md shadow-xl overflow-hidden z-[60]">
                    <Select.Viewport className="p-1">
                      <Select.Item value="team_member" className="flex items-center px-6 py-2 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded cursor-pointer outline-none select-none">
                        <Select.ItemText>Team Member</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2">
                          <Check size={14} />
                        </Select.ItemIndicator>
                      </Select.Item>
                      <Select.Item value="super_user" className="flex items-center px-6 py-2 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded cursor-pointer outline-none select-none">
                        <Select.ItemText>Super User</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2">
                          <Check size={14} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "Inviting..." : "Invite User"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
