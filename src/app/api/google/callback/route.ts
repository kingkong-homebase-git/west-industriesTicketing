import { auth } from "@/auth";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
  saveIntegration,
} from "@/lib/google";

// OAuth redirect target. Exchanges the code for tokens and stores the
// integration, then sends the user back to the settings page.
export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || (role !== "super_user" && role !== "admin")) {
    return new Response("Forbidden", { status: 403 });
  }

  const appUrl = process.env.AUTH_URL ?? new URL(req.url).origin;
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (error) {
    return Response.redirect(`${appUrl}/settings?google=denied`, 302);
  }
  if (!code) {
    return Response.redirect(`${appUrl}/settings?google=error`, 302);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // No refresh token (already-granted consent without prompt). Ask user to
      // disconnect/reconnect — but prompt=consent should prevent this.
      return Response.redirect(`${appUrl}/settings?google=norefresh`, 302);
    }
    const email = await fetchGoogleEmail(tokens.access_token);
    await saveIntegration({
      userId: session.user.id,
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresInSec: tokens.expires_in,
    });
    return Response.redirect(`${appUrl}/settings?google=connected`, 302);
  } catch (err) {
    console.error("[google] callback error:", err);
    return Response.redirect(`${appUrl}/settings?google=error`, 302);
  }
}
