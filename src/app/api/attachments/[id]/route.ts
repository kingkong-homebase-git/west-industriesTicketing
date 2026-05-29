import { auth } from "@/auth";
import { db } from "@/db";
import { attachments } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { assertTicketAccess } from "@/lib/ticket-access";
import { getFileFromSpace } from "@/lib/spaces";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId || !role) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const [att] = await db
    .select({
      ticketId: attachments.ticketId,
      kind: attachments.kind,
      url: attachments.url,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      data: attachments.data,
    })
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);

  if (!att) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await assertTicketAccess(att.ticketId, userId, role);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  // Links have no stored bytes — redirect to the external URL.
  if (att.kind === "link") {
    if (!att.url) return new Response("Not found", { status: 404 });
    return Response.redirect(att.url, 302);
  }

  // If stored in Spaces
  if (att.kind === "file" && att.url) {
    try {
      const body = await getFileFromSpace(att.url);
      const bytes = await (body as any).transformToByteArray();
      const safeName = att.filename.replace(/["\\\r\n]/g, "_");
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": att.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": String(bytes.byteLength),
          "Cache-Control": "private, no-store",
        },
      });
    } catch (e: any) {
      console.error("Failed to fetch file from Spaces:", e);
      return new Response("Failed to fetch attachment from storage", { status: 500 });
    }
  }

  if (!att.data) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Uint8Array.from(att.data);
  const safeName = att.filename.replace(/["\\\r\n]/g, "_");
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}

