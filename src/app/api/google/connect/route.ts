import { auth } from "@/auth";
import { getAuthUrl, googleConfigured } from "@/lib/google";

// Super-user/admin only: kicks off the Google OAuth consent flow.
export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || (role !== "super_user" && role !== "admin")) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!googleConfigured()) {
    return new Response("Google integration is not configured on the server.", {
      status: 500,
    });
  }
  // state = the connecting user's id (used to attribute the integration).
  const url = getAuthUrl(session.user.id);
  return Response.redirect(url, 302);
}
