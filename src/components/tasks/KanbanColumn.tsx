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
    <div className="flex flex-col flex-1 min-w-[280px] max-w-[320px] bg-surface/10 backdrop-blur-md rounded-2xl overflow-hidden border border-border/60 hover:border-accent/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.05)] transition-all duration-300">
      <div className="p-3.5 border-b border-border/40 flex items-center justify-between bg-white/2">
        <h3 className="font-semibold text-sm text-text-primary tracking-wide">{title}</h3>
        <span className="text-xs font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full border border-accent/20">
          {tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-3 flex flex-col gap-3 kanban-col-scroll transition-colors duration-200",
          isOver && "bg-accent/5"
        )}
      >
        <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.length > 0 ? (
            tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={onCardClick} />
            ))
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-sm text-text-secondary/40 border-2 border-dashed border-border/30 rounded-xl bg-surface-2/5 min-h-[150px]">
              <span className="text-xs font-medium">No tickets</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
