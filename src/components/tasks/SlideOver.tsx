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

  const [showConfirmClose, setShowConfirmClose] = useState(false);

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
      import("@/actions/users").then(({ getUsers }) => {
        getUsers().then((users) => setData({ allUsers: users, ticket: null, checklist: [], comments: [] }));
      });
    } else {
      setData(null);
      setShowConfirmClose(false);
    }
  }, [isOpen, ticketId, isCreateMode, onClose]);

  const handleCloseTicket = async () => {
    if (!ticketId) return;

    try {
      await updateTicketStatus(ticketId, { status: "closed", sortOrder: 0 });
      toast.success("Ticket closed");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to close ticket");
    } finally {
      setShowConfirmClose(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 h-full w-full max-w-xl bg-surface/60 backdrop-blur-2xl border-l border-border shadow-2xl z-50 flex flex-col focus:outline-none transition-transform duration-300",
            isOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {showConfirmClose && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-surface/85 backdrop-blur-md border border-border p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
                <h3 className="text-lg font-semibold text-text-primary mb-2">Close Ticket</h3>
                <p className="text-sm text-text-secondary mb-6">
                  Are you sure you want to close this ticket? It will be moved to the closed list.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowConfirmClose(false)}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCloseTicket}
                    className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger/90 transition-colors"
                  >
                    Yes, Close
                  </button>
                </div>
              </div>
            </div>
          )}

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
            <div className="p-4 border-t border-border shrink-0 bg-surface-2/20 backdrop-blur-md">
              <button
                onClick={() => setShowConfirmClose(true)}
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
