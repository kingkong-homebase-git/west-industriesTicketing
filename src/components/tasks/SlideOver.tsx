"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { getTicketDetail, updateTicketStatus } from "@/actions/tickets";
import TicketForm from "./TicketForm";
import ChecklistSection from "./ChecklistSection";
import CommentsSection from "./CommentsSection";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string | null;
  isCreateMode: boolean;
  role: string;
  userId: string;
}

export default function SlideOver({
  isOpen,
  onClose,
  ticketId,
  isCreateMode,
  role,
  userId,
}: SlideOverProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && ticketId && !isCreateMode) {
      setLoading(true);
      getTicketDetail(ticketId)
        .then(setData)
        .catch((err) => {
          toast.error("Failed to load ticket details");
          onClose();
        })
        .finally(() => setLoading(false));
    } else if (isOpen && isCreateMode) {
      // Fetch users for assignee dropdown when creating
      getTicketDetail("00000000-0000-0000-0000-000000000000").catch((err) => {
        // Expected to fail on ticket, but we just need allUsers.
        // Actually, let's just make a separate getUsers action call here if needed,
        // or we can use the getUsers action directly.
      });
      // Better approach: Let's fetch just users for create mode
      import("@/actions/users").then(({ getUsers }) => {
        getUsers().then((users) => setData({ allUsers: users, ticket: null, checklist: [], comments: [] }));
      });
    } else {
      setData(null);
    }
  }, [isOpen, ticketId, isCreateMode, onClose]);

  const handleCloseTicket = async () => {
    if (!ticketId) return;
    if (!window.confirm("Are you sure you want to close this ticket?")) return;

    try {
      await updateTicketStatus(ticketId, { status: "closed", sortOrder: 0 });
      toast.success("Ticket closed");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to close ticket");
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 h-full w-full max-w-xl bg-surface border-l border-border shadow-2xl z-50 flex flex-col focus:outline-none transition-transform duration-300",
            isOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              {isCreateMode ? "New Ticket" : "Ticket Details"}
            </Dialog.Title>
            <Dialog.Close className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
              </div>
            ) : data ? (
              <>
                <TicketForm
                  ticket={data.ticket}
                  isCreateMode={isCreateMode}
                  role={role}
                  userId={userId}
                  allUsers={data.allUsers || []}
                  onClose={onClose}
                  onTicketCreated={(id) => {
                    onClose();
                  }}
                />

                {!isCreateMode && data.ticket && (
                  <>
                    <div className="h-px w-full bg-border" />
                    <ChecklistSection
                      ticketId={data.ticket.id}
                      initialItems={data.checklist}
                      isSuperUser={role === "super_user"}
                    />
                    <div className="h-px w-full bg-border" />
                    <CommentsSection
                      ticketId={data.ticket.id}
                      initialComments={data.comments}
                    />
                  </>
                )}
              </>
            ) : null}
          </div>

          {!isCreateMode && role === "super_user" && data?.ticket?.status !== "closed" && (
            <div className="p-4 border-t border-border shrink-0 bg-surface-2/50">
              <button
                onClick={handleCloseTicket}
                className="w-full py-2.5 rounded-lg border border-danger/30 text-danger font-medium hover:bg-danger/10 transition-colors"
              >
                Close Ticket
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
