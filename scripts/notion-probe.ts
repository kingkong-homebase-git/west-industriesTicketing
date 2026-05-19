import { Client, APIErrorCode, APIResponseError } from "@notionhq/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;

if (!token) {
  console.error("✗ NOTION_TOKEN is missing from .env.local");
  process.exit(1);
}
if (!databaseId) {
  console.error("✗ NOTION_DATABASE_ID is missing from .env.local");
  process.exit(1);
}

const notion = new Client({ auth: token });

function plainTitle(rich: Array<{ plain_text?: string }> | undefined): string {
  return (rich ?? []).map((r) => r.plain_text ?? "").join("") || "(untitled)";
}

async function main() {
  console.log("→ Probing Notion database");
  console.log(`  database_id: ${databaseId}`);
  console.log(`  token: ${token!.slice(0, 7)}…${token!.slice(-4)}`);
  console.log("");

  // ─── Step 1: retrieve the database shell ────────────────────────────────────
  let db;
  try {
    db = await notion.databases.retrieve({ database_id: databaseId! });
  } catch (err) {
    if (err instanceof APIResponseError) {
      console.error(`✗ Notion API error: ${err.code} — ${err.message}`);
      if (err.code === APIErrorCode.ObjectNotFound) {
        console.error("  Likely: integration not connected to this DB page,");
        console.error("  or the ID points at a page, not a database.");
      }
      if (err.code === APIErrorCode.Unauthorized) {
        console.error("  → Token is wrong or revoked.");
      }
    } else {
      console.error("✗ Unexpected error:", err);
    }
    process.exit(1);
  }

  if (db.object !== "database") {
    console.error(`✗ Retrieved object is '${(db as { object: string }).object}', not 'database'.`);
    process.exit(1);
  }

  const dbAny = db as {
    id: string;
    title?: Array<{ plain_text?: string }>;
    created_time?: string;
    last_edited_time?: string;
    is_inline?: boolean;
    data_sources?: Array<{ id: string; name: string }>;
  };

  const title = plainTitle(dbAny.title);

  console.log("✓ Database retrieved");
  console.log(`  Title:        ${title}`);
  console.log(`  ID:           ${dbAny.id}`);
  console.log(`  Created:      ${dbAny.created_time}`);
  console.log(`  Last edited:  ${dbAny.last_edited_time}`);
  console.log(`  Is inline:    ${dbAny.is_inline}`);
  console.log("");

  // ─── Step 2: list data sources ──────────────────────────────────────────────
  const dataSources = dbAny.data_sources ?? [];
  if (dataSources.length === 0) {
    console.error("✗ Database has no data_sources array — unexpected for API 2025-09-03.");
    console.error("  Raw response:");
    console.error(JSON.stringify(db, null, 2));
    process.exit(1);
  }

  console.log(`→ Data sources (${dataSources.length})`);
  for (const ds of dataSources) {
    console.log(`  • ${ds.name}  (id: ${ds.id})`);
  }
  console.log("");

  if (dataSources.length > 1) {
    console.warn("⚠ Multiple data sources detected. Sync code will need to target one explicitly.");
    console.warn("  Probing the first one for now.");
    console.warn("");
  }

  const primaryDs = dataSources[0];

  // ─── Step 3: retrieve the data source (properties live here) ────────────────
  // The Notion JS SDK exposes this under `notion.dataSources.retrieve` in v5.
  // Cast through `unknown` since the typings vary slightly across patch versions.
  const ds = await (notion as unknown as {
    dataSources: {
      retrieve: (args: { data_source_id: string }) => Promise<{
        id: string;
        name: string;
        properties: Record<string, { id: string; type: string; [k: string]: unknown }>;
      }>;
    };
  }).dataSources.retrieve({ data_source_id: primaryDs.id });

  console.log(`→ Properties on data source "${ds.name}"`);
  console.log("");

  for (const [name, prop] of Object.entries(ds.properties)) {
    console.log(`  • ${name}  (type: ${prop.type}, id: ${prop.id})`);

    switch (prop.type) {
      case "status": {
        const cfg = prop.status as {
          options: Array<{ id: string; name: string; color: string }>;
          groups: Array<{ id: string; name: string; color: string; option_ids: string[] }>;
        };
        console.log("    Options:");
        for (const opt of cfg.options) {
          console.log(`      - "${opt.name}"  (id: ${opt.id}, color: ${opt.color})`);
        }
        console.log("    Groups:");
        for (const grp of cfg.groups) {
          const names = grp.option_ids
            .map((oid) => cfg.options.find((o) => o.id === oid)?.name)
            .filter(Boolean);
          console.log(`      - ${grp.name}: [${names.join(", ")}]`);
        }
        break;
      }
      case "select": {
        const cfg = prop.select as { options: Array<{ id: string; name: string; color: string }> };
        console.log("    Options:");
        for (const opt of cfg.options) {
          console.log(`      - "${opt.name}"  (id: ${opt.id}, color: ${opt.color})`);
        }
        break;
      }
      case "multi_select": {
        const cfg = prop.multi_select as { options: Array<{ id: string; name: string; color: string }> };
        console.log("    Options:");
        for (const opt of cfg.options) {
          console.log(`      - "${opt.name}"  (id: ${opt.id}, color: ${opt.color})`);
        }
        break;
      }
      default:
        // Other types (title, rich_text, people, date, etc.) need no extra config.
        break;
    }
  }

  console.log("");

  // ─── Step 4: sample one row from the data source ────────────────────────────
  console.log("→ Sampling 1 row");
  console.log("");

  try {
    const sample = await (notion as unknown as {
      dataSources: {
        query: (args: { data_source_id: string; page_size: number }) => Promise<{
          results: Array<{
            id: string;
            last_edited_time: string;
            properties: Record<string, unknown>;
          }>;
        }>;
      };
    }).dataSources.query({ data_source_id: primaryDs.id, page_size: 1 });

    if (sample.results.length === 0) {
      console.log("  (data source is empty)");
    } else {
      const row = sample.results[0];
      console.log(`  page_id:          ${row.id}`);
      console.log(`  last_edited_time: ${row.last_edited_time}`);
      console.log("  properties:");
      console.log(JSON.stringify(row.properties, null, 2));
    }
  } catch (err) {
    console.error("✗ Failed to sample rows:", err);
  }

  console.log("");
  console.log("✓ Probe complete. Paste the full output back to Claude Code.");
}

main().catch((err) => {
  console.error("✗ Probe failed:", err);
  process.exit(1);
});
