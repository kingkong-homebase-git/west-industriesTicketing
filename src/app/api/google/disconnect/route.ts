import { auth } from "@/auth";
import { disconnectIntegration } from "@/lib/google";

// Super-user/admin only: removes the stored Google integration.
export async function POST() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || (role !== "super_user" && role !== "admin")) {
    return new Response("Forbidden", { status: 403 });
  }
  await disconnectIntegration();
  return Response.json({ ok: true });
}
