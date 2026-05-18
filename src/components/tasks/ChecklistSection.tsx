"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
} from "@/actions/checklist";
import { toast } from "sonner";

interface ChecklistItemProps {
  item: any;
  isSuperUser: boolean;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

function SortableItem({ item, isSuperUser, onToggle, onDelete }: ChecklistItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !isSuperUser });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-2 rounded-md hover:bg-surface-2 transition-colors group",
        isDragging && "opacity-50 bg-surface-2 ring-1 ring-accent z-10"
      )}
    >
      {isSuperUser && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical size={14} />
        </div>
      )}

      <Checkbox.Root
        checked={item.isDone}
        onCheckedChange={(checked) => onToggle(item.id, checked === true)}
        className="w-4 h-4 shrink-0 rounded border border-border flex items-center justify-center bg-surface data-[state=checked]:bg-accent data-[state=checked]:border-accent transition-colors outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface"
      >
        <Checkbox.Indicator>
          <Check size={12} className="text-white" />
        </Checkbox.Indicator>
      </Checkbox.Root>

      <span
        className={cn(
          "flex-1 text-sm text-text-primary transition-colors",
          item.isDone && "text-text-secondary line-through"
        )}
      >
        {item.label}
      </span>

      {isSuperUser && (
        <button
          onClick={() => onDelete(item.id)}
          className="text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity outline-none"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

interface ChecklistSectionProps {
  ticketId: string;
  initialItems: any[];
  isSuperUser: boolean;
}

export default function ChecklistSection({
  ticketId,
  initialItems,
  isSuperUser,
}: ChecklistSectionProps) {
  const [items, setItems] = useState(initialItems);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleToggle = async (id: string, done: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isDone: done } : i)));
    try {
      await toggleChecklistItem(id, done);
    } catch (err: any) {
      toast.error(err.message || "Failed to update item");
      setItems(initialItems); // rollback
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteChecklistItem(id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete item");
      setItems(initialItems); // rollback
    }
  };

  const handleAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newItemLabel.trim()) {
      setIsAdding(true);
      try {
        const newItem = await addChecklistItem({
          ticketId,
          label: newItemLabel.trim(),
        });
        setItems((prev) => [...prev, newItem]);
        setNewItemLabel("");
      } catch (err: any) {
        toast.error(err.message || "Failed to add item");
      } finally {
        setIsAdding(false);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    try {
      await reorderChecklistItems({
        ticketId,
        orderedIds: reordered.map((i) => i.id),
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder items");
      setItems(initialItems); // rollback
    }
  };

  const progress =
    items.length > 0
      ? Math.round((items.filter((i) => i.isDone).length / items.length) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Checklist</h3>
        {items.length > 0 && (
          <span className="text-xs font-medium text-text-secondary">{progress}%</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-accent h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                isSuperUser={isSuperUser}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="pt-2">
        <input
          type="text"
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          onKeyDown={handleAdd}
          disabled={isAdding}
          placeholder="Add an item... (press Enter)"
          className="w-full bg-transparent border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
      </div>
    </div>
  );
}
