// Shared status/priority display metadata for the non-Kanban board views
// (Calendar / Timeline / Feed). Colors are fixed hexes (the theme palette is
// small) chosen to stay distinct and readable in both light and dark modes.

export type StatusMeta = { label: string; color: string };

export const STATUS_META: Record<string, StatusMeta> = {
  not_started: { label: "Not Started", color: "#94a3b8" },
  on_track: { label: "On Track", color: "#3b82f6" },
  behind: { label: "Behind", color: "#f59e0b" },
  at_risk: { label: "At Risk", color: "#fb7185" },
  reprioritized: { label: "Reprioritized", color: "#a855f7" },
  accomplished: { label: "Accomplished", color: "#10b981" },
  failed: { label: "Failed", color: "#9f1239" },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, color: "#94a3b8" };
}

export const PRIORITY_META: Record<string, StatusMeta> = {
  low: { label: "Low", color: "#94a3b8" },
  medium: { label: "Medium", color: "#d97706" },
  high: { label: "High", color: "#e11d48" },
};

export function priorityMeta(priority: string): StatusMeta {
  return PRIORITY_META[priority] ?? { label: priority, color: "#94a3b8" };
}

export const DONE_STATUSES = new Set(["accomplished", "failed"]);
