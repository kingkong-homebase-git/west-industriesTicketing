import { auth } from "@/auth";

export type AllowedRole = "super_user" | "admin" | "team_member";

export async function requireRole(
  allowedRoles: AllowedRole[]
): Promise<{ userId: string; role: string; name: string }> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized: No session");
  }

  const userRole = (session.user as any).role as AllowedRole;

  if (!allowedRoles.includes(userRole)) {
    throw new Error(
      `Forbidden: Requires one of [${allowedRoles.join(", ")}], got ${userRole}`
    );
  }

  return {
    userId: session.user.id,
    role: userRole as string,
    name: session.user.name ?? "",
  };
}

export async function requireSuperUser() {
  return requireRole(["super_user", "admin"]);
}

export async function requireAnyRole() {
  return requireRole(["super_user", "admin", "team_member"]);
}
