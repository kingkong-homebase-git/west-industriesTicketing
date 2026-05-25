"use server";

import { db } from "@/db";
import { attachments } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { requireAnyRole } from "@/lib/require-role";
import { assertTicketAccess } from "@/lib/ticket-access";
import { AddLinkAttachmentSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

// Shape returned to the client — never includes the raw `data` blob.
type AttachmentMeta = {
  id: string;
  kind: "link" | "file";
  url: string | null;
  filename: string;
  mimeType: string | null;
  size: number | null;
  createdAt: Date;
  uploadedById: string | null;
};

export async function addLinkAttachment(
  data: unknown
): Promise<{ ok: true; attachment: AttachmentMeta } | { ok: false; error: string }> {
  const { userId, role } = await requireAnyRole();
  const parsed = AddLinkAttachmentSchema.parse(data);
  await assertTicketAccess(parsed.ticketId, userId, role);

  const label = parsed.label?.trim();
  const [row] = await db
    .insert(attachments)
    .values({
      ticketId: parsed.ticketId,
      kind: "link",
      url: parsed.url,
      filename: label && label.length > 0 ? label : parsed.url,
      uploadedById: userId,
    })
    .returning({
      id: attachments.id,
      kind: attachments.kind,
      url: attachments.url,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      size: attachments.size,
      createdAt: attachments.createdAt,
      uploadedById: attachments.uploadedById,
    });

  revalidatePath("/tasks");
  return { ok: true, attachment: row };
}

export async function uploadAttachment(
  formData: FormData
): Promise<{ ok: true; attachment: AttachmentMeta } | { ok: false; error: string }> {
  const { userId, role } = await requireAnyRole();

  const ticketId = formData.get("ticketId");
  const file = formData.get("file");

  if (typeof ticketId !== "string" || !ticketId) {
    return { ok: false, error: "Missing ticket." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }

  await assertTicketAccess(ticketId, userId, role);

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "File is too large (max 10MB)." };
  }
  // Documents only for now — images are out of scope.
  if (file.type.startsWith("image/")) {
    return { ok: false, error: "Images aren't supported yet — attach documents only." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const [row] = await db
    .insert(attachments)
    .values({
      ticketId,
      kind: "file",
      url: null,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      data: buffer,
      size: file.size,
      uploadedById: userId,
    })
    .returning({
      id: attachments.id,
      kind: attachments.kind,
      url: attachments.url,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      size: attachments.size,
      createdAt: attachments.createdAt,
      uploadedById: attachments.uploadedById,
    });

  revalidatePath("/tasks");
  return { ok: true, attachment: row };
}

export async function deleteAttachment(id: string) {
  const { userId, role } = await requireAnyRole();

  const [att] = await db
    .select({ ticketId: attachments.ticketId })
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);

  if (!att) throw new Error("Attachment not found");
  await assertTicketAccess(att.ticketId, userId, role);

  await db.delete(attachments).where(eq(attachments.id, id));
  revalidatePath("/tasks");
  return { ok: true as const };
}
