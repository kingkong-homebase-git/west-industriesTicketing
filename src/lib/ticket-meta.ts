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

// ─── Eisenhower quadrant ──────────────────────────────────────────────────────
export type QuadrantMeta = { label: string; short: string; rank: number };

export const QUADRANT_META: Record<string, QuadrantMeta> = {
  urgent_important: { label: "Urgent & Important", short: "Do now", rank: 0 },
  not_urgent_important: { label: "Not Urgent · Important", short: "Schedule", rank: 1 },
  urgent_not_important: { label: "Urgent · Not Important", short: "Delegate", rank: 2 },
  not_urgent_not_important: { label: "Not Urgent · Not Important", short: "Later", rank: 3 },
};

export function quadrantMeta(q: string | null | undefined): QuadrantMeta | null {
  if (!q) return null;
  return QUADRANT_META[q] ?? null;
}

// Q1 (Urgent & Important) is the "starred" quadrant: red star on cards + the
// dedicated Priority list.
export function isStarred(q: string | null | undefined): boolean {
  return q === "urgent_important";
}

export function quadrantRank(q: string | null | undefined): number {
  if (!q) return 99;
  return QUADRANT_META[q]?.rank ?? 99;
}
