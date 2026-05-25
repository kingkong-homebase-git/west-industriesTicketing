"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Calendar, Check, ChevronDown, GanttChartSquare, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type BoardView = "kanban" | "calendar" | "timeline" | "feed";

const VIEWS: { id: BoardView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "kanban", label: "Kanban", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "timeline", label: "Timeline", icon: GanttChartSquare },
  { id: "feed", label: "Feed", icon: List },
];

interface ViewSwitcherProps {
  view: BoardView;
  onChange: (view: BoardView) => void;
}

export default function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-surface/30 backdrop-blur-md text-sm font-medium text-text-primary hover:border-accent/50 hover:bg-surface/50 transition-colors focus:outline-none">
        <CurrentIcon size={16} className="text-accent" />
        <span>{current.label}</span>
        <ChevronDown size={14} className="text-text-secondary" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="bg-surface/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl overflow-hidden z-[60] p-1 min-w-[180px]"
        >
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = v.id === view;
            return (
              <DropdownMenu.Item
                key={v.id}
                onSelect={() => onChange(v.id)}
                className={cn(
                  "flex items-center gap-2 text-sm px-3 py-2 rounded-lg cursor-pointer outline-none transition-colors",
                  active
                    ? "text-accent bg-accent/10"
                    : "text-text-primary hover:bg-surface-2"
                )}
              >
                <Icon size={16} className={active ? "text-accent" : "text-text-secondary"} />
                <span className="flex-1">{v.label}</span>
                {active && <Check size={14} className="text-accent" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
