import { cn, deadlineBadge, getInitials } from "@/lib/utils";
import { Clock } from "lucide-react";

export default function DeadlineBadge({ deadline }: { deadline: Date | string | null }) {
  if (!deadline) return null;

  const { label, variant } = deadlineBadge(deadline);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
        variant === "overdue" &&
          "bg-danger/10 text-danger border-danger/20",
        variant === "soon" &&
          "bg-warning/10 text-warning border-warning/20",
        variant === "future" &&
          "bg-surface-2 text-text-secondary border-border"
      )}
    >
      <Clock size={10} />
      {label}
    </div>
  );
}
