import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("Running database migrations...");

  try {
    // 1. Add 'admin' to user_role enum if it does not exist
    // Note: ALTER TYPE ADD VALUE cannot run inside a transaction block in PostgreSQL,
    // but running it directly works.
    await sql`
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
    `;
    console.log("✓ user_role enum successfully updated (admin role allowed).");
  } catch (err: any) {
    // Ignore error if it's already there or duplicate
    console.log("user_role enum update status:", err.message || err);
  }

  try {
    // 2. Create the invites table
    await sql`
      CREATE TABLE IF NOT EXISTS invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'team_member',
        token TEXT UNIQUE NOT NULL,
        message TEXT,
        invited_by_id UUID REFERENCES users(id) ON DELETE CASCADE,
        is_accepted BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        accepted_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `;
    console.log("✓ invites table successfully created or verified.");

    console.log("Database migrations completed successfully!");
  } catch (err: any) {
    console.error("Error running migrations:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
