"use server";

import { db } from "@/db";
import { comments } from "../../drizzle/schema";
import { requireAnyRole } from "@/lib/require-role";
import { AddCommentSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { pushTicketToNotion } from "@/lib/sync/push";
import { debouncePush } from "@/lib/sync/debounce";

export async function addComment(data: unknown) {
  const { userId } = await requireAnyRole();
  const parsed = AddCommentSchema.parse(data);

  const [comment] = await db
    .insert(comments)
    .values({ ...parsed, authorId: userId })
    .returning();

  debouncePush(parsed.ticketId, () => pushTicketToNotion(parsed.ticketId));

  revalidatePath("/tasks");
  return comment;
}
