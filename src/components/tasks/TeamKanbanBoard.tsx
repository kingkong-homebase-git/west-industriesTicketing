"use client";

import { useState, useEffect } from "react";
import TicketCard from "./TicketCard";
import SlideOver from "./SlideOver";

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
                className="w-80 flex flex-col bg-surface-2 rounded-2xl border border-border shrink-0 max-h-full"
              >
                <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-surface-2/95 backdrop-blur z-10 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">{col.title}</h3>
                    <span className="bg-surface text-text-secondary text-xs px-2 py-0.5 rounded-full border border-border">
                      {colTickets.length}
                    </span>
                  </div>
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
                    <div className="text-center p-4 text-sm text-text-secondary border-2 border-dashed border-border rounded-xl">
                      No tasks assigned
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
