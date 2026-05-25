"use server";

import { db } from "@/db";
import { checklistItems } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { requireAnyRole, requireSuperUser } from "@/lib/require-role";
import { AddChecklistItemSchema, ReorderChecklistSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export async function addChecklistItem(data: unknown) {
  await requireAnyRole();
  const parsed = AddChecklistItemSchema.parse(data);

  const existing = await db
    .select({ sortOrder: checklistItems.sortOrder })
    .from(checklistItems)
    .where(eq(checklistItems.ticketId, parsed.ticketId));

  const maxSort = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1);

  const [item] = await db
    .insert(checklistItems)
    .values({ ...parsed, sortOrder: maxSort + 1 })
    .returning();

  revalidatePath("/tasks");
  return item;
}

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  await requireAnyRole();

  const [item] = await db
    .update(checklistItems)
    .set({ isDone })
    .where(eq(checklistItems.id, itemId))
    .returning();

  revalidatePath("/tasks");
  return item;
}

export async function deleteChecklistItem(itemId: string) {
  await requireSuperUser();

  await db.delete(checklistItems).where(eq(checklistItems.id, itemId));

  revalidatePath("/tasks");
}

export async function reorderChecklistItems(data: unknown) {
  await requireSuperUser();
  const parsed = ReorderChecklistSchema.parse(data);

  await Promise.all(
    parsed.orderedIds.map((id, idx) =>
      db
        .update(checklistItems)
        .set({ sortOrder: idx })
        .where(eq(checklistItems.id, id))
    )
  );

  revalidatePath("/tasks");
}
