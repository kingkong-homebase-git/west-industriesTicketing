// Vitest test environment bootstrap.
//
// We set the env vars that notion.ts asserts on at module load BEFORE
// anything else imports it. Without this, importing the sync modules in
// tests throws synchronously.
process.env.NOTION_TOKEN ??= "test_token";
process.env.NOTION_DATABASE_ID ??= "test_database_id";
process.env.NOTION_SYNC_ENABLED ??= "true";
process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/test_db_never_used";
