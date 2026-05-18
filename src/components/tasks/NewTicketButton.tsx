"use client";

import { Plus } from "lucide-react";

interface NewTicketButtonProps {
  role: string;
  onClick: () => void;
}

export default function NewTicketButton({ role, onClick }: NewTicketButtonProps) {
  if (role !== "super_user") return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-8 right-8 w-14 h-14 bg-accent hover:bg-accent-hover text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background z-40"
      title="New Ticket"
    >
      <Plus size={24} />
    </button>
  );
}
