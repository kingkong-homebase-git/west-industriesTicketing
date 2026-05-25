"use client";

import { Plus } from "lucide-react";

interface NewTicketButtonProps {
  onClick: () => void;
}

export default function NewTicketButton({ onClick }: NewTicketButtonProps) {
  // Any authenticated user can create a ticket; team members' tickets are
  // auto-assigned to themselves server-side (see createTicket).
  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 w-14 h-14 bg-accent hover:bg-accent-hover text-white rounded-full shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background z-40 border border-white/10"
      title="New Task"
    >
      <Plus size={28} className="transition-transform group-hover:rotate-90 duration-300" />
    </button>
  );
}
