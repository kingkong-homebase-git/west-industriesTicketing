import { db } from "@/db";
import { googleIntegration } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Config ──────────────────────────────────────────────────────────────────
// Read-only calendar access (we only display the calendar, never write) +
// userinfo.email so we can show which account is connected.
const SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email";
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

// ─── Calendar read (Jacques Calendar view) ──────────────────────────────────────
export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  htmlLink: string | null;
  location: string | null;
}

interface GoogleEventItem {
  id?: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Read events from the connected (Jacques) primary calendar between two ISO
 * timestamps. Read-only — never writes. Returns [] if not connected/on error.
 */
export async function listCalendarEvents(
  timeMinISO: string,
  timeMaxISO: string
): Promise<{ ok: boolean; error?: string; events: CalEvent[] }> {
  const auth = await getValidAccessToken();
  if (!auth) return { ok: false, error: "Not connected to Google Calendar.", events: [] };

  const cal = encodeURIComponent(auth.calendarId);
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true", // expand recurring events
    orderBy: "startTime",
    maxResults: "2500",
  });

  try {
    const res = await fetch(`${CAL_BASE}/${cal}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Google API ${res.status}: ${(await res.text()).slice(0, 300)}`,
        events: [],
      };
    }
    const data = (await res.json()) as { items?: GoogleEventItem[] };
    const events: CalEvent[] = (data.items ?? [])
      .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
      .map((e) => {
        const allDay = !e.start?.dateTime;
        const start = e.start?.dateTime ?? `${e.start?.date}T00:00:00`;
        const end = e.end?.dateTime ?? `${e.end?.date ?? e.start?.date}T00:00:00`;
        return {
          id: e.id ?? start,
          title: e.summary ?? "(no title)",
          start,
          end,
          allDay,
          htmlLink: e.htmlLink ?? null,
          location: e.location ?? null,
        };
      });
    return { ok: true, events };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      events: [],
    };
  }
}
