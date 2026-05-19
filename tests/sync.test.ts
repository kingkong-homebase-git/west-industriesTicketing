/**
 * Sync push/pull tests.
 *
 * Strategy: mock @notionhq/client and @/db at the module level. The DB mock
 * uses a chainable Proxy that resolves to a per-call queued value — this
 * mirrors drizzle's fluent API (select().from().where().limit() awaits to
 * an array; insert().values().returning() awaits to an array; etc.)
 * without us having to know exactly which chain shape each code path uses.
 *
 * Each test sets up:
 *   1. The DB call queue (selectQ.push(...), insertQ.push(...), etc.) — one
 *      entry per top-level db.<method>() call the code under test will make.
 *   2. The Notion client method mocks — pages.create / pages.update /
 *      pages.retrieve / blocks.children.list / blocks.children.append /
 *      blocks.delete.
 * Then it imports and invokes push.ts or pull.ts and asserts on:
 *   - Which Notion calls happened with what arguments
 *   - Which DB writes were queued (we capture inserts via a side channel)
 *   - The counts in pull's PullResult
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Notion mocks ───────────────────────────────────────────────────────────
const pagesCreate = vi.fn();
const pagesUpdate = vi.fn();
const pagesRetrieve = vi.fn();
const blocksList = vi.fn();
const blocksAppend = vi.fn();
const blocksDelete = vi.fn();
const databasesRetrieve = vi.fn();
const dataSourcesRetrieve = vi.fn();
const dataSourcesQuery = vi.fn();

vi.mock("@notionhq/client", () => {
  class Client {
    pages = {
      create: pagesCreate,
      update: pagesUpdate,
      retrieve: pagesRetrieve,
    };
    blocks = {
      children: { list: blocksList, append: blocksAppend },
      delete: blocksDelete,
    };
    databases = { retrieve: databasesRetrieve };
    dataSources = { retrieve: dataSourcesRetrieve, query: dataSourcesQuery };
  }
  class APIResponseError extends Error {}
  return {
    Client,
    APIErrorCode: { ObjectNotFound: "object_not_found", Unauthorized: "unauthorized" },
    APIResponseError,
  };
});

// ─── DB mocks ───────────────────────────────────────────────────────────────
// Queues of values to return for each top-level db.<verb>() call in order.
type Queue<T = unknown> = T[];
let selectQ: Queue<unknown[]> = [];
let insertQ: Queue<unknown[]> = [];
let updateQ: Queue<unknown[]> = [];

// Capture every insert/update call so tests can assert on writes.
const inserts: Array<{ table: unknown; values: unknown }> = [];
const updates: Array<{ table: unknown; values: unknown; whereCalled: boolean }> = [];

function chainable<T>(resolveValue: T): unknown {
  const recordingState: { lastSetValues?: unknown } = {};
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(resolveValue).then(resolve, reject);
        }
        // For .set() on update chains, remember the set values so we can
        // record them when the chain is awaited.
        if (prop === "set") {
          return (values: unknown) => {
            recordingState.lastSetValues = values;
            return chainable(resolveValue);
          };
        }
        return () => chainable(resolveValue);
      },
    }
  );
}

vi.mock("@/db", () => {
  return {
    db: {
      select: vi.fn((_cols?: unknown) => {
        const next = selectQ.shift() ?? [];
        return chainable(next);
      }),
      insert: vi.fn((table: unknown) => {
        // Capture values via a values() override on the chain.
        return new Proxy(
          {},
          {
            get(_, prop) {
              if (prop === "then") {
                return (resolve: (v: unknown[]) => unknown) =>
                  Promise.resolve(insertQ.shift() ?? []).then(resolve);
              }
              if (prop === "values") {
                return (values: unknown) => {
                  inserts.push({ table, values });
                  // After .values(), return a chain that resolves to next insertQ value.
                  return chainable(insertQ.shift() ?? []);
                };
              }
              return () => chainable(insertQ.shift() ?? []);
            },
          }
        );
      }),
      update: vi.fn((table: unknown) => {
        const captured: { setValues?: unknown } = {};
        return new Proxy(
          {},
          {
            get(_, prop) {
              if (prop === "then") {
                return (resolve: (v: unknown[]) => unknown) =>
                  Promise.resolve(updateQ.shift() ?? []).then(resolve);
              }
              if (prop === "set") {
                return (values: unknown) => {
                  captured.setValues = values;
                  updates.push({ table, values, whereCalled: false });
                  return chainable(updateQ.shift() ?? []);
                };
              }
              return () => chainable(updateQ.shift() ?? []);
            },
          }
        );
      }),
      delete: vi.fn(() => chainable([])),
    },
  };
});

// ─── Imports under test (after mocks!) ─────────────────────────────────────
const { pushTicketToNotion } = await import("@/lib/sync/push");
const { pullAllFromNotion } = await import("@/lib/sync/pull");
const {
  notionPropertyToTicketFields,
  ticketFieldsToNotionProperties,
} = await import("@/lib/notion");

// ─── Shared fixtures ────────────────────────────────────────────────────────
function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-uuid-1",
    title: "Test ticket",
    description: "A description.",
    status: "on_track",
    priority: "medium",
    assigneeId: null,
    creatorId: null,
    deadline: null,
    deadlineEnd: null,
    sortOrder: 0,
    project: null,
    expectedResults: null,
    notionPageId: null,
    notionLastEditedTime: null,
    notionSyncStatus: "never",
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

function notionPageStub(overrides: Record<string, unknown> = {}) {
  return {
    id: "notion-page-id-abc",
    last_edited_time: "2026-05-19T10:00:00.000Z",
    properties: {
      Name: { type: "title", title: [{ plain_text: "Test ticket" }] },
      Status: { type: "select", select: { name: "On-Track" } },
      Project: { type: "rich_text", rich_text: [] },
      "Expected Results": { type: "rich_text", rich_text: [] },
      "Due Date": { type: "date", date: null },
    },
    ...overrides,
  };
}

function databaseStub() {
  return {
    object: "database",
    id: "db-id",
    data_sources: [{ id: "data-source-id", name: "Tasks" }],
  };
}

function dataSourceStub() {
  return {
    properties: {
      Status: {
        id: "OEqn",
        type: "select",
        select: {
          options: [
            { id: "1", name: "Not Started", color: "gray" },
            { id: "2", name: "On-Track", color: "green" },
            { id: "3", name: "Behind", color: "yellow" },
            { id: "4", name: "At Risk", color: "orange" },
            { id: "5", name: "Reprioritized", color: "purple" },
            { id: "6", name: "Accomplished", color: "blue" },
            { id: "7", name: "Failed", color: "red" },
          ],
        },
      },
      Name: { id: "title", type: "title" },
      Project: { id: "kZA?", type: "rich_text" },
      "Expected Results": { id: "ABAQ", type: "rich_text" },
      "Due Date": { id: "qCO", type: "date" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  selectQ = [];
  insertQ = [];
  updateQ = [];
  inserts.length = 0;
  updates.length = 0;
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("push.ts — pushTicketToNotion", () => {
  it("creates a Notion page when notion_page_id is null", async () => {
    const ticket = ticketRow({ notionPageId: null });
    selectQ = [[ticket], [], []]; // select ticket, checklist, comments

    databasesRetrieve.mockResolvedValue(databaseStub());
    dataSourcesRetrieve.mockResolvedValue(dataSourceStub());
    pagesCreate.mockResolvedValue({
      id: "new-notion-page-id",
      last_edited_time: "2026-05-19T11:00:00.000Z",
    });
    blocksList.mockResolvedValue({ results: [] });
    blocksAppend.mockResolvedValue({});
    pagesRetrieve.mockResolvedValue({
      id: "new-notion-page-id",
      last_edited_time: "2026-05-19T11:00:00.000Z",
    });

    await pushTicketToNotion(ticket.id);

    expect(pagesCreate).toHaveBeenCalledOnce();
    expect(pagesUpdate).not.toHaveBeenCalled();
    // First update writes notion_page_id back to the row.
    const updateForLinking = updates.find(
      (u) => (u.values as { notionPageId?: string }).notionPageId
    );
    expect(updateForLinking).toBeTruthy();
    expect(
      (updateForLinking!.values as { notionPageId: string }).notionPageId
    ).toBe("new-notion-page-id");
    // A sync_logs row is inserted with status=success.
    expect(
      inserts.some(
        (i) =>
          (i.values as { status?: string; direction?: string }).status ===
            "success" &&
          (i.values as { direction?: string }).direction === "push"
      )
    ).toBe(true);
  });

  it("updates an existing Notion page when notion_page_id is set", async () => {
    const ticket = ticketRow({
      notionPageId: "existing-page",
      notionLastEditedTime: new Date("2026-05-19T09:00:00.000Z"),
    });
    selectQ = [[ticket], [], []];

    databasesRetrieve.mockResolvedValue(databaseStub());
    dataSourcesRetrieve.mockResolvedValue(dataSourceStub());
    pagesRetrieve
      .mockResolvedValueOnce({
        id: "existing-page",
        // Same as local stored → no conflict.
        last_edited_time: "2026-05-19T09:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "existing-page",
        last_edited_time: "2026-05-19T12:00:00.000Z",
      });
    pagesUpdate.mockResolvedValue({});
    blocksList.mockResolvedValue({ results: [] });
    blocksAppend.mockResolvedValue({});

    await pushTicketToNotion(ticket.id);

    expect(pagesCreate).not.toHaveBeenCalled();
    expect(pagesUpdate).toHaveBeenCalledOnce();
    const successLog = inserts.find(
      (i) => (i.values as { status?: string }).status === "success"
    );
    expect(successLog).toBeTruthy();
  });

  it("aborts and logs conflict when Notion's last_edited_time is newer than local", async () => {
    const ticket = ticketRow({
      notionPageId: "existing-page",
      notionLastEditedTime: new Date("2026-05-19T09:00:00.000Z"),
    });
    selectQ = [[ticket]];

    pagesRetrieve.mockResolvedValueOnce({
      id: "existing-page",
      // Notion is one hour newer than our stored notion_last_edited_time.
      last_edited_time: "2026-05-19T10:00:00.000Z",
    });

    await pushTicketToNotion(ticket.id);

    expect(pagesUpdate).not.toHaveBeenCalled();
    expect(pagesCreate).not.toHaveBeenCalled();
    const conflict = inserts.find(
      (i) =>
        (i.values as { status?: string }).status === "failure" &&
        (i.values as { errorMessage?: string }).errorMessage ===
          "notion_newer_aborting_push"
    );
    expect(conflict).toBeTruthy();
    // notionSyncStatus on the ticket should flip to "failed".
    const failedFlag = updates.find(
      (u) =>
        (u.values as { notionSyncStatus?: string }).notionSyncStatus === "failed"
    );
    expect(failedFlag).toBeTruthy();
  });
});

describe("pull.ts — pullAllFromNotion", () => {
  it("skips pages where last_edited_time equals local notion_last_edited_time (echo suppression)", async () => {
    const sameTime = new Date("2026-05-19T09:00:00.000Z");
    const existing = ticketRow({
      notionPageId: "echo-page",
      notionLastEditedTime: sameTime,
      updatedAt: new Date("2026-05-19T08:00:00.000Z"),
    });

    selectQ = [
      [], // initial select syncState → empty (first run)
      [existing], // lookup existing ticket by notion_page_id
    ];

    databasesRetrieve.mockResolvedValue(databaseStub());
    dataSourcesRetrieve.mockResolvedValue(dataSourceStub());
    dataSourcesQuery.mockResolvedValue({
      results: [
        notionPageStub({
          id: "echo-page",
          last_edited_time: sameTime.toISOString(),
        }),
      ],
      has_more: false,
      next_cursor: null,
    });

    const result = await pullAllFromNotion();

    expect(result.totalPages).toBe(1);
    expect(result.skippedEcho).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.inserted).toBe(0);
    // No update call for the ticket itself (only the sync_state upsert).
    const ticketUpdate = updates.find(
      (u) => (u.values as { notionLastEditedTime?: Date }).notionLastEditedTime
    );
    expect(ticketUpdate).toBeFalsy();
  });

  it("applies the update when Notion is strictly newer than local", async () => {
    const olderLocal = new Date("2026-05-19T08:00:00.000Z");
    const newerNotion = new Date("2026-05-19T10:00:00.000Z");
    const existing = ticketRow({
      notionPageId: "newer-page",
      notionLastEditedTime: olderLocal,
      updatedAt: olderLocal,
    });

    selectQ = [
      [], // syncState
      [existing], // lookup by notion_page_id
    ];

    databasesRetrieve.mockResolvedValue(databaseStub());
    dataSourcesRetrieve.mockResolvedValue(dataSourceStub());
    dataSourcesQuery.mockResolvedValue({
      results: [
        notionPageStub({
          id: "newer-page",
          last_edited_time: newerNotion.toISOString(),
          properties: {
            ...notionPageStub().properties,
            Name: { type: "title", title: [{ plain_text: "Renamed in Notion" }] },
          },
        }),
      ],
      has_more: false,
      next_cursor: null,
    });
    blocksList.mockResolvedValue({ results: [] });

    const result = await pullAllFromNotion();

    expect(result.updated).toBe(1);
    expect(result.skippedEcho).toBe(0);
    expect(result.skippedConflict).toBe(0);
    const ticketUpdate = updates.find(
      (u) => (u.values as { title?: string }).title === "Renamed in Notion"
    );
    expect(ticketUpdate).toBeTruthy();
  });

  it("skips and logs conflict when local updated_at is newer than Notion's last_edited_time", async () => {
    const notionTime = new Date("2026-05-19T08:00:00.000Z");
    const localNewer = new Date("2026-05-19T10:00:00.000Z");
    const existing = ticketRow({
      notionPageId: "conflict-page",
      notionLastEditedTime: new Date("2026-05-19T07:00:00.000Z"),
      updatedAt: localNewer,
    });

    selectQ = [
      [], // syncState
      [existing], // lookup
    ];

    databasesRetrieve.mockResolvedValue(databaseStub());
    dataSourcesRetrieve.mockResolvedValue(dataSourceStub());
    dataSourcesQuery.mockResolvedValue({
      results: [
        notionPageStub({
          id: "conflict-page",
          last_edited_time: notionTime.toISOString(),
        }),
      ],
      has_more: false,
      next_cursor: null,
    });
    blocksList.mockResolvedValue({ results: [] });

    const result = await pullAllFromNotion();

    expect(result.skippedConflict).toBe(1);
    expect(result.updated).toBe(0);
    const conflictLog = inserts.find(
      (i) =>
        (i.values as { errorMessage?: string }).errorMessage ===
        "local_newer_aborting_pull"
    );
    expect(conflictLog).toBeTruthy();
  });
});

describe("status enum mapping is bidirectional and lossless", () => {
  const allStatuses = [
    "not_started",
    "on_track",
    "behind",
    "at_risk",
    "reprioritized",
    "accomplished",
    "failed",
  ] as const;

  for (const status of allStatuses) {
    it(`round-trips ${status}`, () => {
      // Send-shape: what we'd post to Notion (no `type` field — Notion
      // only requires `type` on read responses, not on write payloads).
      const props = ticketFieldsToNotionProperties({
        title: "x",
        status,
        project: null,
        expectedResults: null,
        deadline: null,
        deadlineEnd: null,
      });
      const sendStatus = (
        props as { Status: { select: { name: string } } }
      ).Status;

      // Wrap with `type: "select"` so the parser (which requires it on
      // reads) accepts our synthesized page.
      const recovered = notionPropertyToTicketFields({
        id: "p",
        last_edited_time: "2026-05-19T00:00:00.000Z",
        properties: {
          Name: { type: "title", title: [{ plain_text: "x" }] },
          Status: { type: "select", select: sendStatus.select },
        },
      });

      expect(recovered.status).toBe(status);
    });
  }
});
