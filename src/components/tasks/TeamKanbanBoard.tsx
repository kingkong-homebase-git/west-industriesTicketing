"use client";

import { useState, useEffect } from "react";
import TicketCard from "./TicketCard";
import SlideOver from "./SlideOver";
import * as Avatar from "@radix-ui/react-avatar";
import { getInitials } from "@/lib/utils";

interface TeamKanbanBoardProps {
  initialTickets: any[];
  users: any[];
  role: string;
  userId: string;
}

export default function TeamKanbanBoard({ initialTickets, users, role, userId }: TeamKanbanBoardProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Sync state when props change
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const columns = [
    { id: "unassigned", title: "Unassigned", user: null },
    ...users.map(u => ({ id: u.id, title: u.name, user: u }))
  ];

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Team Board</h1>
        <p className="text-sm text-text-secondary">View tasks assigned to each team member</p>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-w-max items-start">
          {columns.map((col) => {
            const colTickets = tickets.filter((t) => {
              if (col.id === "unassigned") return !t.assigneeId;
              return t.assigneeId === col.id;
            });

            return (
              <div
                key={col.id}
                className="w-80 flex flex-col bg-surface/30 backdrop-blur-md rounded-2xl border border-border shrink-0 max-h-full hover:border-accent/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all duration-300"
              >
                <div className="p-3.5 border-b border-border flex items-center justify-between sticky top-0 bg-surface-2/20 backdrop-blur-md z-10 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    {col.user ? (
                      <Avatar.Root className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                        <Avatar.Fallback className="text-xs font-semibold text-accent">
                          {getInitials(col.title)}
                        </Avatar.Fallback>
                      </Avatar.Root>
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-dashed border-border/50 flex items-center justify-center text-xs text-text-secondary/60 shrink-0">
                        ?
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-text-primary text-sm leading-none tracking-wide">{col.title}</h3>
                      <p className="text-[10px] text-text-secondary mt-1">Assignee</p>
                    </div>
                  </div>
                  <span className="bg-accent/10 text-accent text-xs font-semibold px-2 py-0.5 rounded-full border border-accent/20">
                    {colTickets.length}
                  </span>
                </div>
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {colTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => {
                        setSelectedTicketId(ticket.id);
                        setIsSlideOverOpen(true);
                      }}
                    />
                  ))}
                  {colTickets.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-sm text-text-secondary/40 border-2 border-dashed border-border/30 rounded-xl bg-surface-2/5 min-h-[150px]">
                      <span className="text-xs font-medium">No tasks assigned</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => {
          setIsSlideOverOpen(false);
          setSelectedTicketId(null);
        }}
        ticketId={selectedTicketId}
        isCreateMode={false}
        role={role}
        userId={userId}
      />
    </div>
  );
}
