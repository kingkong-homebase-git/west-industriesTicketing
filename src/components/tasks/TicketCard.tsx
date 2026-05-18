"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, getInitials } from "@/lib/utils";
import DeadlineBadge from "./DeadlineBadge";
import { CheckSquare } from "lucide-react";
import * as Avatar from "@radix-ui/react-avatar";

interface TicketCardProps {
  ticket: any;
  onClick: (id: string) => void;
}

export default function TicketCard({ ticket, onClick }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: ticket.id,
      data: { type: "Ticket", ticket },
    });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const priorityColors = {
    low: "bg-text-secondary",
    medium: "bg-warning",
    high: "bg-danger",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(ticket.id)}
      className={cn(
        "bg-surface border border-border p-3 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-accent transition-colors relative group",
        isDragging && "opacity-50 ring-2 ring-accent"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-text-primary leading-tight line-clamp-2">
          {ticket.title}
        </h4>
        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0 mt-1",
            priorityColors[ticket.priority as keyof typeof priorityColors]
          )}
        />
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          {ticket.assigneeName ? (
            <Avatar.Root className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center">
              <Avatar.Fallback className="text-[10px] font-medium text-text-secondary">
                {getInitials(ticket.assigneeName)}
              </Avatar.Fallback>
            </Avatar.Root>
          ) : (
            <div className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center text-[10px] text-text-secondary">
              ?
            </div>
          )}
          
          <DeadlineBadge deadline={ticket.deadline} />
        </div>

        <div
          className={cn(
            "flex items-center gap-1 text-[11px]",
            ticket.checklistProgress.done === ticket.checklistProgress.total && ticket.checklistProgress.total > 0
              ? "text-success"
              : "text-text-secondary"
          )}
        >
          <CheckSquare size={12} />
          <span>
            {ticket.checklistProgress.done}/{ticket.checklistProgress.total}
          </span>
        </div>
      </div>
    </div>
  );
}
