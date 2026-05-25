"use server";

import { db } from "@/db";
import { projects } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { requireAnyRole, requireSuperUser } from "@/lib/require-role";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(80),
  color: z.string().max(20).optional().nullable(),
});

export async function getProjects() {
  await requireAnyRole();
  return db.select().from(projects).orderBy(asc(projects.name));
}

export async function createProject(data: unknown) {
  await requireSuperUser();
  const parsed = CreateProjectSchema.parse(data);

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, parsed.name))
    .limit(1);
  if (existing) {
    return { ok: false as const, error: "A project with that name already exists." };
  }

  const [project] = await db
    .insert(projects)
    .values({ name: parsed.name, color: parsed.color ?? null })
    .returning();

  revalidatePath("/", "layout");
  return { ok: true as const, project };
}

export async function deleteProject(projectId: string) {
  await requireSuperUser();
  // tickets.project_id is ON DELETE SET NULL, so tickets are unlinked, not deleted.
  await db.delete(projects).where(eq(projects.id, projectId));
  revalidatePath("/", "layout");
  return { ok: true as const };
}
