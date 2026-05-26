"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { updateTicket, createTicket } from "@/actions/tickets";
import { toast } from "sonner";
import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUADRANT_META } from "@/lib/ticket-meta";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface TicketFormProps {
  ticket: any;
  isCreateMode: boolean;
  role: string;
  userId: string;
  allUsers: any[];
  projects: { id: string; name: string }[];
  onClose: () => void;
  onTicketCreated?: (id: string) => void;
}

export default function TicketForm({
  ticket,
  isCreateMode,
  role,
  userId,
  allUsers,
  projects,
  onClose,
  onTicketCreated,
}: TicketFormProps) {
  const [title, setTitle] = useState(ticket?.title || "");
  const [description, setDescription] = useState(ticket?.description || "");
  const [status, setStatus] = useState(ticket?.status || "not_started");
  const [priority, setPriority] = useState(ticket?.priority || "medium");
  const [quadrant, setQuadrant] = useState(ticket?.quadrant || "none");
  const [assigneeId, setAssigneeId] = useState(ticket?.assigneeId || "none");
  const [projectId, setProjectId] = useState(ticket?.projectId || "none");
  const [deadline, setDeadline] = useState<Date | null>(
    ticket?.deadline ? new Date(ticket?.deadline) : null
  );

  const [isEditingDesc, setIsEditingDesc] = useState(isCreateMode);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);

  // Match the markdown editor + preview to the active theme so text stays
  // legible in light mode (the editor was hardcoded to dark).
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Privileged roles edit any ticket; team members edit tickets they own
  // (assigned to or created by them). Create mode is always editable.
  const isPrivileged = role === "super_user" || role === "admin";
  const isOwner =
    !!ticket && (ticket.assigneeId === userId || ticket.creatorId === userId);
  const canEdit = isCreateMode || isPrivileged || isOwner;
  // Only privileged roles may set the assignee; team-member tickets are pinned
  // to the creator server-side.
  const canEditAssignee = isPrivileged;
  const canEditFields = canEdit;

  const triggerSave = async (updates: any) => {
    if (isCreateMode) return; // create mode saves explicitly
    if (!canEdit) return;

    setIsSaving(true);
    try {
      await updateTicket(ticket.id, updates);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setIsSaving(true);
    try {
      const newTicket = await createTicket({
        title,
        description,
        priority,
        quadrant: quadrant === "none" ? null : quadrant,
        status,
        assigneeId: assigneeId === "none" ? null : assigneeId,
        projectId: projectId === "none" ? null : projectId,
        deadline: deadline ? deadline.toISOString() : null,
      });
      toast.success("Task created");
      onTicketCreated?.(newTicket.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to create task");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      {isCreateMode ? (
        // In create mode, render a clearly labelled, bordered input so users
        // (especially on mobile) know to type a title — the borderless heading
        // style read as a static placeholder and got skipped.
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Title <span className="text-danger">*</span>
          </label>
          <input
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full bg-surface-2/40 border border-border/60 text-text-primary rounded-xl px-3.5 py-2.5 text-base font-semibold focus:outline-none focus:border-accent hover:border-accent/60 transition-all"
          />
        </div>
      ) : (
        <div>
          {canEditFields ? (
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => {
                  if (e.target.value.trim()) triggerSave({ title: e.target.value });
                }, 600);
              }}
              placeholder="Ticket title..."
              className="w-full text-xl font-bold bg-transparent border-none outline-none focus:ring-0 placeholder-text-secondary/50 text-text-primary"
            />
          ) : (
            <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          )}
        </div>
      )}

      {/* Meta Grid */}
      <div className="grid grid-cols-2 gap-4 border-y border-border py-4">
        {/* Status */}
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-medium">Status</label>
          <Select.Root
            value={status}
            onValueChange={(val) => {
              setStatus(val);
              triggerSave({ status: val });
            }}
            disabled={!canEdit}
          >
            <Select.Trigger className="flex items-center justify-between w-full text-sm bg-surface/20 backdrop-blur-sm border border-border/60 px-3 py-1.5 rounded-md hover:border-accent hover:bg-surface/30 transition-all disabled:opacity-50">
              <Select.Value />
              <Select.Icon>
                <ChevronDown size={14} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-surface/90 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-[60]">
                <Select.Viewport className="p-1">
                  {[
                    "not_started",
                    "on_track",
                    "behind",
                    "at_risk",
                    "reprioritized",
                    "accomplished",
                    "failed",
                  ].map((s) => (
                    <Select.Item
                      key={s}
                      value={s}
                      className="flex items-center px-6 py-1.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded cursor-pointer outline-none select-none data-[state=checked]:text-accent"
                    >
                      <Select.ItemText className="capitalize">
                        {s.replace(/_/g, " ")}
                      </Select.ItemText>
                      <Select.ItemIndicator className="absolute left-1.5">
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-medium">Priority</label>
          <Select.Root
            value={priority}
            onValueChange={(val) => {
              setPriority(val);
              triggerSave({ priority: val });
            }}
            disabled={!canEditFields}
          >
            <Select.Trigger className="flex items-center justify-between w-full text-sm bg-surface/20 backdrop-blur-sm border border-border/60 px-3 py-1.5 rounded-md hover:border-accent hover:bg-surface/30 transition-all disabled:opacity-50">
              <Select.Value />
              <Select.Icon>
                <ChevronDown size={14} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-surface/90 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-[60]">
                <Select.Viewport className="p-1">
                  {["low", "medium", "high"].map((p) => (
                    <Select.Item
                      key={p}
                      value={p}
                      className="flex items-center px-6 py-1.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded cursor-pointer outline-none select-none data-[state=checked]:text-accent"
                    >
                      <Select.ItemText className="capitalize">{p}</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-1.5">
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Priority matrix (Eisenhower quadrant) */}
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-medium">
            Priority matrix
          </label>
          <Select.Root
            value={quadrant}
            onValueChange={(val) => {
              setQuadrant(val);
              triggerSave({ quadrant: val === "none" ? null : val });
            }}
            disabled={!canEditFields}
          >
            <Select.Trigger className="flex items-center justify-between w-full text-sm bg-surface/20 backdrop-blur-sm border border-border/60 px-3 py-1.5 rounded-md hover:border-accent hover:bg-surface/30 transition-all disabled:opacity-50">
              <Select.Value placeholder="None" />
              <Select.Icon>
                <ChevronDown size={14} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-surface/90 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-[60]">
                <Select.Viewport className="p-1">
                  <Select.Item
                    value="none"
                    className="flex items-center px-6 py-1.5 text-sm text-text-secondary hover:bg-accent/20 rounded cursor-pointer outline-none"
                  >
                    <Select.ItemText>None</Select.ItemText>
                  </Select.Item>
                  {Object.entries(QUADRANT_META).map(([key, meta]) => (
                    <Select.Item
                      key={key}
                      value={key}
                      className="flex items-center px-6 py-1.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded cursor-pointer outline-none select-none data-[state=checked]:text-accent"
                    >
                      <Select.ItemText>{meta.label}</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-1.5">
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Assignee — privileged only; team-member tickets auto-assign to self
            server-side, so we hide the picker for them in create mode. */}
        {(isPrivileged || !isCreateMode) && (
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-medium">Assignee</label>
          <Select.Root
            value={assigneeId}
            onValueChange={(val) => {
              setAssigneeId(val);
              triggerSave({ assigneeId: val === "none" ? null : val });
            }}
            disabled={!canEditAssignee}
          >
            <Select.Trigger className="flex items-center justify-between w-full text-sm bg-surface/20 backdrop-blur-sm border border-border/60 px-3 py-1.5 rounded-md hover:border-accent hover:bg-surface/30 transition-all disabled:opacity-50">
              <Select.Value />
              <Select.Icon>
                <ChevronDown size={14} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-surface/90 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-[60]">
                <Select.Viewport className="p-1">
                  <Select.Item value="none" className="flex items-center px-6 py-1.5 text-sm text-text-secondary hover:bg-accent/20 rounded cursor-pointer outline-none">
                    <Select.ItemText>Unassigned</Select.ItemText>
                  </Select.Item>
                  {allUsers.map((u) => (
                    <Select.Item
                      key={u.id}
                      value={u.id}
                      className="flex items-center px-6 py-1.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded cursor-pointer outline-none select-none"
                    >
                      <Select.ItemText>{u.name}</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-1.5">
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
        )}

        {/* Project */}
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-medium">Project</label>
          <Select.Root
            value={projectId}
            onValueChange={(val) => {
              setProjectId(val);
              triggerSave({ projectId: val === "none" ? null : val });
            }}
            disabled={!canEditFields}
          >
            <Select.Trigger className="flex items-center justify-between w-full text-sm bg-surface/20 backdrop-blur-sm border border-border/60 px-3 py-1.5 rounded-md hover:border-accent hover:bg-surface/30 transition-all disabled:opacity-50">
              <Select.Value />
              <Select.Icon>
                <ChevronDown size={14} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="bg-surface/90 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-[60]">
                <Select.Viewport className="p-1">
                  <Select.Item value="none" className="flex items-center px-6 py-1.5 text-sm text-text-secondary hover:bg-accent/20 rounded cursor-pointer outline-none">
                    <Select.ItemText>No project</Select.ItemText>
                  </Select.Item>
                  {projects.map((p) => (
                    <Select.Item
                      key={p.id}
                      value={p.id}
                      className="flex items-center px-6 py-1.5 text-sm text-text-primary hover:bg-accent/20 hover:text-accent rounded cursor-pointer outline-none select-none"
                    >
                      <Select.ItemText>{p.name}</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-1.5">
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Deadline */}
        <div className="space-y-1">
          <label className="text-xs text-text-secondary font-medium">Deadline</label>
          {canEditFields ? (
            <Popover.Root>
              <Popover.Trigger className="flex items-center justify-between w-full text-sm bg-surface/20 backdrop-blur-sm border border-border/60 px-3 py-1.5 rounded-md hover:border-accent hover:bg-surface/30 transition-all">
                <span className={!deadline ? "text-text-secondary" : "text-text-primary"}>
                  {deadline ? format(deadline, "PPP") : "Set date"}
                </span>
                <CalendarIcon size={14} className="text-text-secondary" />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="bg-surface/95 backdrop-blur-xl border border-border/80 p-3 rounded-xl shadow-2xl z-[60] mt-1 w-64">
                  <input
                    type="date"
                    className="w-full bg-surface border border-border text-text-primary rounded-md px-3 py-1.5 outline-none focus:border-accent"
                    onChange={(e) => {
                      if (!e.target.value) {
                        setDeadline(null);
                        triggerSave({ deadline: null });
                      } else {
                        const d = new Date(e.target.value);
                        setDeadline(d);
                        triggerSave({ deadline: d.toISOString() });
                      }
                    }}
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          ) : (
            <div className="text-sm px-3 py-1.5 text-text-primary">
              {deadline ? format(deadline, "PPP") : "None"}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-text-primary">Description</label>
          {canEditFields && !isCreateMode && (
            <button
              onClick={() => setIsEditingDesc(!isEditingDesc)}
              className="text-xs text-accent hover:underline"
            >
              {isEditingDesc ? "Preview" : "Edit"}
            </button>
          )}
        </div>

        {isEditingDesc ? (
          <div data-color-mode={isDark ? "dark" : "light"} className="border border-border rounded-md overflow-hidden">
            <MDEditor
              value={description}
              onChange={(val) => {
                setDescription(val || "");
                if (!isCreateMode && canEditFields) {
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = setTimeout(() => {
                    triggerSave({ description: val || "" });
                  }, 1000);
                }
              }}
              preview="edit"
              height={200}
              className="!bg-surface/60"
            />
          </div>
        ) : (
          <div className={cn("prose prose-sm max-w-none bg-surface/10 backdrop-blur-md border border-border/40 p-4 rounded-xl min-h-[100px]", isDark && "prose-invert")}>
            {description ? (
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{description}</ReactMarkdown>
            ) : (
              <p className="text-text-secondary italic">No description provided.</p>
            )}
          </div>
        )}
      </div>

      {/* Create Button */}
      {isCreateMode && (
        <div className="pt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isSaving}
            className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? "Creating..." : "Create Task"}
          </button>
        </div>
      )}
    </div>
  );
}
