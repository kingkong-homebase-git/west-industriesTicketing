import { Client } from "@notionhq/client";
import type { TicketStatus } from "../../drizzle/schema";

// ─── Env + kill switch ──────────────────────────────────────────────────────
// NOTION_SYNC_ENABLED defaults to true so the sync runs unless explicitly
// disabled. Token/DB id are only required when sync is on, so dev environments
// without Notion credentials can still boot the app by setting this to false.
export const NOTION_SYNC_ENABLED =
  (process.env.NOTION_SYNC_ENABLED ?? "true").toLowerCase() === "true";

const token = process.env.NOTION_TOKEN;
const databaseIdEnv = process.env.NOTION_DATABASE_ID;

if (NOTION_SYNC_ENABLED) {
  if (!token) {
    throw new Error(
      "NOTION_TOKEN env var is required when NOTION_SYNC_ENABLED=true"
    );
  }
  if (!databaseIdEnv) {
    throw new Error(
      "NOTION_DATABASE_ID env var is required when NOTION_SYNC_ENABLED=true"
    );
  }
}

export const NOTION_DATABASE_ID = databaseIdEnv ?? "";
export const notion = NOTION_SYNC_ENABLED
  ? new Client({ auth: token! })
  : (null as unknown as Client);

// ─── Status name maps (Notion option name ⇄ dashboard enum) ─────────────────
// Hardcoded both directions so a rename in Notion fails loudly here rather
// than silently producing wrong sync results.
const NOTION_TO_STATUS: Record<string, TicketStatus> = {
  "Not Started": "not_started",
  "On-Track": "on_track",
  Behind: "behind",
  "At Risk": "at_risk",
  Reprioritized: "reprioritized",
  Accomplished: "accomplished",
  Failed: "failed",
};

const STATUS_TO_NOTION: Record<TicketStatus, string> = {
  not_started: "Not Started",
  on_track: "On-Track",
  behind: "Behind",
  at_risk: "At Risk",
  reprioritized: "Reprioritized",
  accomplished: "Accomplished",
  failed: "Failed",
};

// ─── Rate limiter ───────────────────────────────────────────────────────────
// Notion's documented limit is ~3 requests/sec averaged. Token bucket with
// capacity 3, refilled continuously. In-memory, per-process — matches the
// prompt's "no library" constraint.
const RATE_LIMIT_PER_SEC = 3;
let tokens = RATE_LIMIT_PER_SEC;
let lastRefill = Date.now();

type QueuedCall = {
  fn: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

const queue: QueuedCall[] = [];
let draining = false;

function refill() {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  if (elapsed <= 0) return;
  tokens = Math.min(RATE_LIMIT_PER_SEC, tokens + elapsed * RATE_LIMIT_PER_SEC);
  lastRefill = now;
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      refill();
      if (tokens < 1) {
        const waitMs = Math.ceil(((1 - tokens) / RATE_LIMIT_PER_SEC) * 1000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      tokens -= 1;
      const next = queue.shift()!;
      try {
        const result = await next.fn();
        next.resolve(result);
      } catch (err) {
        next.reject(err);
      }
    }
  } finally {
    draining = false;
  }
}

export function rateLimitedNotionCall<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      fn: fn as () => Promise<unknown>,
      resolve: resolve as (v: unknown) => void,
      reject,
    });
    void drain();
  });
}

// ─── Schema / data-source cache ─────────────────────────────────────────────
// Notion API 2025-09-03 moved properties off the database object onto a
// per-database "data source." We resolve database → primary data source once
// and cache the schema for 10 min. The cached schema is what callers need:
// the data source ID (for queries), property metadata, and the Status
// option-name → option-id map.
type CachedSchema = {
  dataSourceId: string;
  properties: Record<
    string,
    { id: string; type: string; [k: string]: unknown }
  >;
  statusOptionIds: Map<string, string>;
};

let schemaCache: { schema: CachedSchema; expiresAt: number } | null = null;
const SCHEMA_TTL_MS = 10 * 60 * 1000;

// The v5 SDK ships the dataSources namespace but the public typings are still
// catching up. Narrow it locally so the rest of the file is type-safe.
type DataSourceClient = {
  retrieve: (args: { data_source_id: string }) => Promise<{
    name?: string;
    properties: Record<
      string,
      { id: string; type: string; [k: string]: unknown }
    >;
  }>;
  query: (args: {
    data_source_id: string;
    page_size?: number;
    start_cursor?: string;
    filter?: unknown;
    sorts?: unknown;
  }) => Promise<{
    results: Array<{
      id: string;
      last_edited_time: string;
      properties: Record<string, unknown>;
    }>;
    has_more: boolean;
    next_cursor: string | null;
  }>;
};

export function getDataSources(): DataSourceClient {
  if (!NOTION_SYNC_ENABLED) {
    throw new Error("Notion sync is disabled (NOTION_SYNC_ENABLED=false)");
  }
  return (notion as unknown as { dataSources: DataSourceClient }).dataSources;
}

export async function getDatabaseSchema(): Promise<CachedSchema> {
  if (!NOTION_SYNC_ENABLED) {
    throw new Error("Notion sync is disabled (NOTION_SYNC_ENABLED=false)");
  }

  const now = Date.now();
  if (schemaCache && schemaCache.expiresAt > now) return schemaCache.schema;

  const db = await rateLimitedNotionCall(() =>
    notion.databases.retrieve({ database_id: NOTION_DATABASE_ID })
  );
  const dataSources = (db as { data_sources?: Array<{ id: string }> })
    .data_sources;
  if (!dataSources || dataSources.length === 0) {
    throw new Error(
      `Notion database ${NOTION_DATABASE_ID} has no data sources`
    );
  }
  const dataSourceId = dataSources[0].id;

  const ds = await rateLimitedNotionCall(() =>
    getDataSources().retrieve({ data_source_id: dataSourceId })
  );

  const statusOptionIds = new Map<string, string>();
  const statusProp = ds.properties["Status"];
  if (statusProp && statusProp.type === "select") {
    const cfg = statusProp.select as {
      options: Array<{ id: string; name: string }>;
    };
    for (const opt of cfg.options) statusOptionIds.set(opt.name, opt.id);
  }

  const schema: CachedSchema = {
    dataSourceId,
    properties: ds.properties,
    statusOptionIds,
  };
  schemaCache = { schema, expiresAt: now + SCHEMA_TTL_MS };
  return schema;
}

export function invalidateSchemaCache(): void {
  schemaCache = null;
}

// ─── Mappers ────────────────────────────────────────────────────────────────
export type NotionTicketFields = {
  title: string;
  status: TicketStatus | null;
  project: string | null;
  expectedResults: string | null;
  deadline: Date | null;
  deadlineEnd: Date | null;
  notionLastEditedTime: Date;
};

type NotionPageLike = {
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
};

function plainText(
  rich: Array<{ plain_text?: string }> | undefined
): string {
  return (rich ?? []).map((r) => r.plain_text ?? "").join("");
}

export function notionPropertyToTicketFields(
  page: NotionPageLike
): NotionTicketFields {
  const p = page.properties as Record<string, unknown>;

  const titleProp = p["Name"] as
    | { type: "title"; title: Array<{ plain_text?: string }> }
    | undefined;
  const statusProp = p["Status"] as
    | { type: "select"; select: { name: string } | null }
    | undefined;
  const projectProp = p["Project"] as
    | { type: "rich_text"; rich_text: Array<{ plain_text?: string }> }
    | undefined;
  const expectedProp = p["Expected Results"] as
    | { type: "rich_text"; rich_text: Array<{ plain_text?: string }> }
    | undefined;
  const dueProp = p["Due Date"] as
    | {
        type: "date";
        date: { start: string | null; end: string | null } | null;
      }
    | undefined;

  const title =
    titleProp?.type === "title" ? plainText(titleProp.title) : "";

  let status: TicketStatus | null = null;
  if (statusProp?.type === "select" && statusProp.select) {
    status = NOTION_TO_STATUS[statusProp.select.name] ?? null;
  }

  const project =
    projectProp?.type === "rich_text"
      ? plainText(projectProp.rich_text) || null
      : null;

  const expectedResults =
    expectedProp?.type === "rich_text"
      ? plainText(expectedProp.rich_text) || null
      : null;

  let deadline: Date | null = null;
  let deadlineEnd: Date | null = null;
  if (dueProp?.type === "date" && dueProp.date) {
    if (dueProp.date.start) deadline = new Date(dueProp.date.start);
    if (dueProp.date.end) deadlineEnd = new Date(dueProp.date.end);
  }

  return {
    title,
    status,
    project,
    expectedResults,
    deadline,
    deadlineEnd,
    notionLastEditedTime: new Date(page.last_edited_time),
  };
}

export type TicketForNotion = {
  title: string;
  status: TicketStatus;
  project: string | null;
  expectedResults: string | null;
  deadline: Date | null;
  deadlineEnd: Date | null;
};

export function ticketFieldsToNotionProperties(
  ticket: TicketForNotion
): Record<string, unknown> {
  return {
    Name: {
      title: [{ type: "text", text: { content: ticket.title } }],
    },
    Status: {
      select: { name: STATUS_TO_NOTION[ticket.status] },
    },
    Project: {
      rich_text: ticket.project
        ? [{ type: "text", text: { content: ticket.project } }]
        : [],
    },
    "Expected Results": {
      rich_text: ticket.expectedResults
        ? [{ type: "text", text: { content: ticket.expectedResults } }]
        : [],
    },
    "Due Date": ticket.deadline
      ? {
          date: {
            start: ticket.deadline.toISOString(),
            end: ticket.deadlineEnd ? ticket.deadlineEnd.toISOString() : null,
          },
        }
      : { date: null },
  };
}
