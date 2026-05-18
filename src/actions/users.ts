"use server";

import { db } from "@/db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { requireAnyRole, requireSuperUser } from "@/lib/require-role";
import { CreateUserSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function createUser(data: unknown) {
  await requireSuperUser();
  const parsed = CreateUserSchema.parse(data);

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email: parsed.email,
      name: parsed.name,
      passwordHash,
      role: parsed.role,
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  revalidatePath("/team");
  return user;
}

export async function archiveUser(userId: string) {
  await requireSuperUser();

  const [user] = await db
    .update(users)
    .set({ isArchived: true })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  revalidatePath("/team");
  return user;
}

export async function getUsers(includeArchived = false) {
  await requireAnyRole();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isArchived: users.isArchived,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.name);

  if (includeArchived) return rows;
  return rows.filter((u) => !u.isArchived);
}
