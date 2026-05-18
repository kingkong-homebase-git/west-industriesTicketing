import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

// Load .env.local for local seeding
dotenv.config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log(`Seeding super_user: ${email}`);

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await db.insert(users).values({
      email,
      name: "Super Admin",
      passwordHash,
      role: "super_user",
    }).onConflictDoNothing({ target: users.email });

    console.log("Seed complete. Super user created or already exists.");
  } catch (err) {
    console.error("Error seeding database:", err);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
