import { db } from "@/db";
import { googleIntegration, tickets, projects } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Config ──────────────────────────────────────────────────────────────────
// calendar.events to read/write events; userinfo.email so we can show which
// account is connected.
const SCOPE =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";
const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";

function clientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}
function clientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}
function redirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.AUTH_URL ?? "http://localhost:3000"}/api/google/callback`
  );
}

export function googleConfigured(): boolean {
  return !!(clientId() && clientSecret());
}

// ─── OAuth ───────────────────────────────────────────────────────────────────
export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // we need a refresh token
    prompt: "consent", // force refresh-token issuance every time
    include_granted_scopes: "true",
    state,
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Fetch the connected account's email (for display) using an access token. */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

/** Store (replace) the single active integration after a successful connect. */
export async function saveIntegration(opts: {
  userId: string;
  email: string | null;
  refreshToken: string;
  accessToken: string;
  expiresInSec: number;
}): Promise<void> {
  await db.delete(googleIntegration); // single active integration
  await db.insert(googleIntegration).values({
    userId: opts.userId,
    email: opts.email,
    refreshToken: opts.refreshToken,
    accessToken: opts.accessToken,
    accessTokenExpiresAt: new Date(Date.now() + opts.expiresInSec * 1000),
  });
}

export async function getIntegration() {
  const [row] = await db.select().from(googleIntegration).limit(1);
  return row ?? null;
}

export async function disconnectIntegration(): Promise<void> {
  await db.delete(googleIntegration);
}

/** Returns a valid access token, refreshing via the refresh token if needed. */
async function getValidAccessToken(): Promise<{ token: string; calendarId: string; userId: string | null } | null> {
  const row = await getIntegration();
  if (!row) return null;

  const stillValid =
    row.accessToken &&
    row.accessTokenExpiresAt &&
    row.accessTokenExpiresAt.getTime() - 60_000 > Date.now();
  if (stillValid) {
    return { token: row.accessToken!, calendarId: row.calendarId, userId: row.userId };
  }

  // Refresh.
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: row.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("[google] token refresh failed:", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as TokenResponse;
  await db
    .update(googleIntegration)
    .set({
      accessToken: data.access_token,
      accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(googleIntegration.id, row.id));
  return { token: data.access_token, calendarId: row.calendarId, userId: row.userId };
}

// ─── Calendar event sync ───────────────────────────────────────────────────────
const CLOSED = new Set(["accomplished", "failed"]);

function buildEventBody(ticket: {
  title: string;
  description: string | null;
  deadline: Date | null;
}) {
  const start = ticket.deadline ? new Date(ticket.deadline) : new Date();
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30-minute block
  const appUrl = process.env.AUTH_URL ?? "https://app.westindustriesintl.com";
  return {
    summary: ticket.title,
    description: `${ticket.description ? ticket.description + "\n\n" : ""}— via Hemisphere ${appUrl}/tasks`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    source: { title: "Hemisphere", url: `${appUrl}/tasks` },
  };
}

/**
 * One-way sync of a single task to the connected (CEO) calendar. An event is
 * created/updated for an active task with a deadline **only when** the task is
 * in the "Subprime Kings" project OR flagged Urgent & Important; otherwise any
 * existing event is removed. Never throws — logs and returns.
 */
export async function syncTicketToGoogle(ticketId: string): Promise<void> {
  try {
    const auth = await getValidAccessToken();
    if (!auth) return; // not connected / refresh failed

    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
    if (!ticket) return;

    // Look up the project name for the Subprime Kings rule.
    let projectName: string | null = null;
    if (ticket.projectId) {
      const [proj] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, ticket.projectId))
        .limit(1);
      projectName = proj?.name ?? null;
    }
    const isSubprimeKings = !!projectName && projectName.toLowerCase().includes("subprime");
    const isUrgentImportant = ticket.quadrant === "urgent_important";

    const qualifies =
      !!ticket.deadline &&
      !CLOSED.has(ticket.status) &&
      (isSubprimeKings || isUrgentImportant);

    const cal = encodeURIComponent(auth.calendarId);
    const headers = {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    };

    if (qualifies) {
      const body = buildEventBody(ticket);
      if (ticket.googleEventId) {
        // Update existing event.
        const res = await fetch(
          `${CAL_BASE}/${cal}/events/${encodeURIComponent(ticket.googleEventId)}`,
          { method: "PATCH", headers, body: JSON.stringify(body) }
        );
        if (res.status === 404) {
          // Event was deleted on Google — recreate.
          await createEvent(cal, headers, body, ticketId);
        } else if (!res.ok) {
          console.error("[google] event update failed:", res.status, await res.text());
        }
      } else {
        await createEvent(cal, headers, body, ticketId);
      }
    } else if (ticket.googleEventId) {
      // No longer qualifies — remove the event.
      const res = await fetch(
        `${CAL_BASE}/${cal}/events/${encodeURIComponent(ticket.googleEventId)}`,
        { method: "DELETE", headers }
      );
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        console.error("[google] event delete failed:", res.status, await res.text());
      }
      await db.update(tickets).set({ googleEventId: null }).where(eq(tickets.id, ticketId));
    }
  } catch (err) {
    console.error("[google] syncTicketToGoogle error:", err);
  }
}

/**
 * Create a throwaway test event on the connected calendar to prove the
 * connection works end-to-end. Returns a clear result for the UI (link on
 * success, the Google error text on failure).
 */
export async function createTestCalendarEvent(): Promise<{
  ok: boolean;
  error?: string;
  link?: string;
}> {
  const auth = await getValidAccessToken();
  if (!auth) {
    return { ok: false, error: "Not connected to Google Calendar." };
  }
  const cal = encodeURIComponent(auth.calendarId);
  const start = new Date(Date.now() + 5 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const body = {
    summary: "Hemisphere — test event (safe to delete)",
    description: "If you can see this, Hemisphere → Google Calendar sync is working.",
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
  try {
    const res = await fetch(`${CAL_BASE}/${cal}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Google API ${res.status}: ${(await res.text()).slice(0, 300)}`,
      };
    }
    const ev = (await res.json()) as { htmlLink?: string };
    return { ok: true, link: ev.htmlLink };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Delete a calendar event by id (used when a task is hard-deleted). Never throws. */
export async function deleteCalendarEventById(eventId: string): Promise<void> {
  try {
    const auth = await getValidAccessToken();
    if (!auth) return;
    const cal = encodeURIComponent(auth.calendarId);
    const res = await fetch(
      `${CAL_BASE}/${cal}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` } }
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error("[google] delete-by-id failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[google] deleteCalendarEventById error:", err);
  }
}

async function createEvent(
  cal: string,
  headers: Record<string, string>,
  body: object,
  ticketId: string
): Promise<void> {
  const res = await fetch(`${CAL_BASE}/${cal}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[google] event create failed:", res.status, await res.text());
    return;
  }
  const event = (await res.json()) as { id?: string };
  if (event.id) {
    await db.update(tickets).set({ googleEventId: event.id }).where(eq(tickets.id, ticketId));
  }
}
