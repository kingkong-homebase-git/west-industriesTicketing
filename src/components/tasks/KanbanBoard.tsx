"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import KanbanColumn from "./KanbanColumn";
import TicketCard from "./TicketCard";
import NewTicketButton from "./NewTicketButton";
import SlideOver from "./SlideOver";
import { updateTicketStatus } from "@/actions/tickets";
import { getTicketSyncStatus } from "@/actions/sync";

interface KanbanBoardProps {
  initialTickets: any[];
  role: string;
  userId: string;
}

const COLUMNS = [
  { id: "not_started", title: "Not Started" },
  { id: "on_track", title: "On Track" },
  { id: "behind", title: "Behind" },
  { id: "at_risk", title: "At Risk" },
  { id: "reprioritized", title: "Reprioritized" },
  { id: "accomplished", title: "Accomplished" },
  { id: "failed", title: "Failed" },
];

const DONE_STATUSES = new Set(["accomplished", "failed"]);

export default function KanbanBoard({ initialTickets, role, userId }: KanbanBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tickets, setTickets] = useState(initialTickets);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // Sync state when props change (from polling/server actions)
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  // Polling logic
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, 10_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  const columns = COLUMNS;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getTicketById = (id: string) => tickets.find((t) => t.id === id);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTicket = active.data.current?.type === "Ticket";
    const isOverTicket = over.data.current?.type === "Ticket";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTicket) return;

    // Moving ticket over another ticket
    if (isOverTicket) {
      setTickets((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        const overIndex = prev.findIndex((t) => t.id === overId);

        if (prev[activeIndex].status !== prev[overIndex].status) {
          const newTickets = [...prev];
          newTickets[activeIndex] = { ...prev[activeIndex], status: prev[overIndex].status };
          return arrayMove(newTickets, activeIndex, overIndex);
        }
        return arrayMove(prev, activeIndex, overIndex);
      });
    }

    // Moving ticket to empty column area
    if (isOverColumn) {
      setTickets((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        if (prev[activeIndex].status !== overId) {
          const newTickets = [...prev];
          newTickets[activeIndex] = { ...prev[activeIndex], status: overId as string };
          return arrayMove(newTickets, activeIndex, prev.length - 1);
        }
        return prev;
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const activeTicket = getTicketById(activeId);
    if (!activeTicket) return;

    const newStatus = activeTicket.status;

    // My Tasks only ever shows the current user's own tickets, so any move
    // here is on a ticket they own — the server (assertTicketAccess) is the
    // source of truth and will reject anything else.

    // Calculate new sort orders for the target column
    const ticketsInColumn = tickets.filter(t => t.status === newStatus);
    const updatedTickets = ticketsInColumn.map((t, index) => ({ ...t, sortOrder: index }));

    // Optimistically update state with new sort orders
    setTickets((prev) => {
      const copy = [...prev];
      updatedTickets.forEach(ut => {
        const idx = copy.findIndex(t => t.id === ut.id);
        if (idx !== -1) copy[idx] = ut;
      });
      return copy;
    });

    const droppedTicket = updatedTickets.find(t => t.id === activeId);
    if (!droppedTicket) return;

    // Persist to server
    try {
      await updateTicketStatus(activeId, {
        status: droppedTicket.status,
        sortOrder: droppedTicket.sortOrder
      });
      // Push to Notion is debounced ~2s. Check the sync_status shortly
      // after — if it's "failed", surface a toast with a link to logs.
      // Only super_users see this hook (only they can change status).
      setTimeout(async () => {
        try {
          const status = await getTicketSyncStatus(activeId);
          if (status?.status === "failed") {
            toast.error("Notion sync failed — see /admin/sync-logs", {
              duration: 6000,
            });
          }
        } catch {
          // Silent — surfacing a "couldn't check sync status" toast would be noise.
        }
      }, 3500);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
      setTickets(initialTickets); // rollback
    }
  }

  const totalTasks = tickets.length;
  const onTrackTasks = tickets.filter((t) => t.status === "on_track").length;
  const accomplishedTasks = tickets.filter((t) => t.status === "accomplished").length;
  const overdueTasks = tickets.filter((t) => {
    if (DONE_STATUSES.has(t.status)) return false;
    if (!t.deadline) return false;
    return new Date(t.deadline) < new Date();
  }).length;

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="bg-surface/30 backdrop-blur-md border border-border/60 p-5 rounded-2xl shadow-xl flex flex-col gap-3 hover:border-accent/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Total Task</span>
            <span className="text-xs font-medium bg-accent/20 text-accent px-2 py-1 rounded-full">All</span>
          </div>
          <div className="text-3xl font-bold text-text-primary">{totalTasks}</div>
          <div className="text-xs text-text-secondary">Current active tickets</div>
        </div>

        {/* Overdue */}
        <div className="bg-surface/30 backdrop-blur-md border border-border/60 p-5 rounded-2xl shadow-xl flex flex-col gap-3 hover:border-accent/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Overdue Task</span>
            <span className="text-xs font-medium bg-danger/20 text-danger px-2 py-1 rounded-full">Late</span>
          </div>
          <div className="text-3xl font-bold text-text-primary">{overdueTasks}</div>
          <div className="text-xs text-text-secondary">Past deadline</div>
        </div>

        {/* On Track */}
        <div className="bg-surface/30 backdrop-blur-md border border-border/60 p-5 rounded-2xl shadow-xl flex flex-col gap-3 hover:border-accent/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">On Track</span>
            <span className="text-xs font-medium bg-warning/20 text-warning px-2 py-1 rounded-full">Active</span>
          </div>
          <div className="text-3xl font-bold text-text-primary">{onTrackTasks}</div>
          <div className="text-xs text-text-secondary">Being worked on</div>
        </div>

        {/* Accomplished */}
        <div className="bg-surface/30 backdrop-blur-md border border-border/60 p-5 rounded-2xl shadow-xl flex flex-col gap-3 hover:border-accent/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Accomplished</span>
            <span className="text-xs font-medium bg-success/20 text-success px-2 py-1 rounded-full">Done</span>
          </div>
          <div className="text-3xl font-bold text-text-primary">{accomplishedTasks}</div>
          <div className="text-xs text-text-secondary">Successfully finished</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">My Tasks</h2>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-w-max items-start">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                tickets={tickets.filter((t) => t.status === col.id)}
                onCardClick={(id) => {
                  setSelectedTicketId(id);
                  setIsCreateMode(false);
                  setIsSlideOverOpen(true);
                }}
              />
            ))}
            <DragOverlay>
              {activeId ? (
                <TicketCard ticket={getTicketById(activeId)} onClick={() => {}} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      <NewTicketButton
        onClick={() => {
          setSelectedTicketId(null);
          setIsCreateMode(true);
          setIsSlideOverOpen(true);
        }}
      />

      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => {
          setIsSlideOverOpen(false);
          setSelectedTicketId(null);
        }}
        ticketId={selectedTicketId}
        isCreateMode={isCreateMode}
        role={role}
        userId={userId}
      />
    </div>
  );
}
