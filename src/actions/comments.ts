"use server";

import { db } from "@/db";
import { comments } from "../../drizzle/schema";
import { requireAnyRole } from "@/lib/require-role";
import { AddCommentSchema } from "@/lib/validations";
import { notifyMentioned } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export async function addComment(data: unknown) {
  const { userId, name } = await requireAnyRole();
  const parsed = AddCommentSchema.parse(data);
  // mentionedUserIds isn't a column — keep it out of the insert.
  const { mentionedUserIds, ...commentData } = parsed;

  const [comment] = await db
    .insert(comments)
    .values({ ...commentData, authorId: userId })
    .returning();

  // Email mentioned teammates (skip self). Fire-and-forget.
  const ids = (mentionedUserIds ?? []).filter((id) => id !== userId);
  if (ids.length) {
    void notifyMentioned({
      userIds: ids,
      ticketId: parsed.ticketId,
      commenterName: name,
      snippet: parsed.body.slice(0, 200),
    }).catch((e) => console.error("[notify] mention:", e));
  }

  revalidatePath("/tasks");
  return comment;
}
