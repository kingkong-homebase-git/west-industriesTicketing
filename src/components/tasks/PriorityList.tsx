"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CheckSquare, Star } from "lucide-react";
import SlideOver from "./SlideOver";
import DeadlineBadge from "./DeadlineBadge";
import { getInitials } from "@/lib/utils";
import { priorityMeta, statusMeta } from "@/lib/ticket-meta";

interface PriorityListProps {
  initialTickets: any[];
  role: string;
  userId: string;
}

export default function PriorityList({
  initialTickets,
  role,
  userId,
}: PriorityListProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  // Soonest deadline first; undated tasks sink to the bottom.
  const sorted = useMemo(() => {
    return [...tickets].sort((a, b) => {
      const at = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bt = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return at - bt;
    });
  }, [tickets]);

  const openTicket = (id: string) => {
    setSelectedTicketId(id);
    setIsSlideOverOpen(true);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Star size={22} style={{ fill: "#ef4444", color: "#fca5a5" }} />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Priority</h1>
          <p className="text-sm text-text-secondary">
            Urgent &amp; important active tasks across the team
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-text-secondary/60 border-2 border-dashed border-border/30 rounded-2xl p-10">
          <Star size={32} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">Nothing urgent &amp; important right now.</p>
          <p className="text-xs mt-1">
            Set a task&apos;s Priority matrix to &quot;Urgent &amp; Important&quot; and it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto kanban-col-scroll pr-1">
          <div className="max-w-3xl space-y-2">
            {sorted.map((t) => {
              const sMeta = statusMeta(t.status);
              const pMeta = priorityMeta(t.priority);
              const total = t.checklistProgress?.total ?? 0;
              const done = t.checklistProgress?.done ?? 0;
              return (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className="w-full text-left flex items-start gap-3 p-3.5 rounded-xl bg-surface/30 backdrop-blur-md border border-border/50 hover:border-accent/50 hover:bg-surface/50 transition-colors"
                >
                  <Star
                    size={16}
                    strokeWidth={1.5}
                    style={{ fill: "#ef4444", color: "#fca5a5" }}
                    className="shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {t.title}
                      </span>
                      {t.projectName && (
                        <span className="text-[10px] text-text-secondary shrink-0">
                          {t.projectName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ color: sMeta.color, backgroundColor: `${sMeta.color}1a` }}
                      >
                        {sMeta.label}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: pMeta.color }}>
                        {pMeta.label}
                      </span>
                      <DeadlineBadge deadline={t.deadline} />
                      {t.deadline && (
                        <span className="text-[10px] text-text-secondary">
                          {format(new Date(t.deadline), "MMM d")}
                        </span>
                      )}
                      {total > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-text-secondary">
                          <CheckSquare size={11} />
                          {done}/{total}
                        </span>
                      )}
                      {t.assigneeName && (
                        <span className="flex items-center gap-1 text-[10px] text-text-secondary ml-auto">
                          <span className="w-4 h-4 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[8px]">
                            {getInitials(t.assigneeName)}
                          </span>
                          {t.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => {
          setIsSlideOverOpen(false);
          setSelectedTicketId(null);
          router.refresh();
        }}
        ticketId={selectedTicketId}
        isCreateMode={false}
        role={role}
        userId={userId}
      />
    </div>
  );
}
