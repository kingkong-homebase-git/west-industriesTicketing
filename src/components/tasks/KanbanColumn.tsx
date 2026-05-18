"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TicketCard from "./TicketCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  tickets: any[];
  onCardClick: (id: string) => void;
}

export default function KanbanColumn({ id, title, tickets, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: "Column", id },
  });

  return (
    <div className="flex flex-col flex-1 min-w-[280px] max-w-[320px] bg-surface-2/30 rounded-xl overflow-hidden border border-border">
      <div className="p-3 border-b border-border flex items-center justify-between bg-surface-2/50">
        <h3 className="font-semibold text-sm text-text-primary">{title}</h3>
        <span className="text-xs font-medium bg-surface px-2 py-0.5 rounded-full text-text-secondary border border-border">
          {tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 flex flex-col gap-2 kanban-col-scroll transition-colors",
          isOver && "bg-accent/5"
        )}
      >
        <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.length > 0 ? (
            tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={onCardClick} />
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-text-secondary/50 italic py-8 border-2 border-dashed border-border/50 rounded-lg">
              No tickets
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
