import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type DeadlineBadgeVariant = "overdue" | "soon" | "future" | "none";

export function deadlineBadge(deadline: Date | string | null | undefined): {
  label: string;
  variant: DeadlineBadgeVariant;
} {
  if (!deadline) return { label: "", variant: "none" };

  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  const now = new Date();

  if (d < now) {
    return { label: "Overdue", variant: "overdue" };
  }

  const hoursUntil = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= 24) {
    return { label: "Due soon", variant: "soon" };
  }

  return { label: format(d, "MMM d"), variant: "future" };
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
