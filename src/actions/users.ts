"use server";

import { db } from "@/db";
import { users, invites } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { requireAnyRole, requireSuperUser } from "@/lib/require-role";
import { CreateUserSchema, InviteUserSchema, AcceptInviteSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/email";

// ─── Native User Actions ──────────────────────────────────────────────────────
export async function createUser(data: unknown) {
  await requireSuperUser();
  const parsed = CreateUserSchema.parse(data);

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email: parsed.email.toLowerCase(),
      name: parsed.name,
      passwordHash,
      role: parsed.role,
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  revalidatePath("/team");
  return user;
}

export async function archiveUser(userId: string) {
  const actor = await requireSuperUser();

  // Can't archive your own account.
  if (actor.userId === userId) {
    throw new Error("You cannot archive your own account.");
  }

  const [target] = await db
    .select({ role: users.role, isArchived: users.isArchived })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) throw new Error("User not found.");

  // Don't strand the workspace: keep at least one active super_user.
  if (target.role === "super_user" && !target.isArchived) {
    const activeSupers = await db.$count(
      users,
      and(eq(users.role, "super_user"), eq(users.isArchived, false))
    );
    if (activeSupers <= 1) {
      throw new Error("Cannot archive the last active super user.");
    }
  }

  const [user] = await db
    .update(users)
    .set({ isArchived: true })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  revalidatePath("/team");
  return user;
}

export async function restoreUser(userId: string) {
  await requireSuperUser();

  const [user] = await db
    .update(users)
    .set({ isArchived: false })
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

// ─── Invite System Actions ────────────────────────────────────────────────────
export async function inviteUser(data: unknown) {
  // 1. Enforce super_user or admin role
  const inviter = await requireSuperUser();
  const parsed = InviteUserSchema.parse(data);

  const emailLower = parsed.email.toLowerCase();

  // 2. Check if user already exists as active user
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  // Validation failures are RETURNED, not thrown: Next.js redacts thrown
  // server-action error messages in production (the client only sees a generic
  // "Server Components render error"), so returning a value lets the UI show
  // the real, friendly message.
  if (existingUser[0]) {
    return {
      ok: false as const,
      error: "This email is already registered as an active member.",
    };
  }

  // 3. Check for existing pending invite
  const existingInvite = await db
    .select()
    .from(invites)
    .where(eq(invites.email, emailLower))
    .limit(1);

  if (existingInvite[0]) {
    if (existingInvite[0].isAccepted) {
      return {
        ok: false as const,
        error: "This person has already accepted an invitation.",
      };
    }
    // If expired, clean it up so we can recreate it
    if (new Date(existingInvite[0].expiresAt) < new Date()) {
      await db.delete(invites).where(eq(invites.id, existingInvite[0].id));
    } else {
      return {
        ok: false as const,
        error:
          "An active invitation has already been sent to this email. You can resend it from the team list instead.",
      };
    }
  }

  // 4. Generate secure token & expiration (48 hours)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // 5. Insert new invite row
  const [newInvite] = await db
    .insert(invites)
    .values({
      name: parsed.name,
      email: emailLower,
      role: parsed.role,
      token,
      message: parsed.message,
      invitedById: inviter.userId,
      expiresAt,
    })
    .returning();

  // 6. Send the real email or fall back to log printing
  const appUrl = process.env.AUTH_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/accept-invite?token=${token}`;

  const emailResult = await sendInviteEmail({
    toEmail: newInvite.email,
    inviteeName: newInvite.name,
    inviterName: inviter.name || "Administrator",
    inviteLink,
    personalMessage: newInvite.message,
  });

  revalidatePath("/team");
  return {
    ok: true as const,
    emailDelivered: emailResult.delivered,
    invite: { ...newInvite, inviteLink },
  };
}

export async function resendInvite(inviteId: string) {
  const inviter = await requireSuperUser();

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1);

  if (!invite) {
    throw new Error("Invitation not found.");
  }

  if (invite.isAccepted) {
    throw new Error("This invitation has already been accepted.");
  }

  // Renew token and expiration
  const newToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db
    .update(invites)
    .set({
      token: newToken,
      expiresAt,
      createdAt: new Date(),
    })
    .where(eq(invites.id, inviteId));

  const appUrl = process.env.AUTH_URL || "http://localhost:3000";
  const inviteLink = `${appUrl}/accept-invite?token=${newToken}`;

  const emailResult = await sendInviteEmail({
    toEmail: invite.email,
    inviteeName: invite.name,
    inviterName: inviter.name || "Administrator",
    inviteLink,
    personalMessage: invite.message,
  });

  revalidatePath("/team");
  return { success: true, emailDelivered: emailResult.delivered, inviteLink };
}

export async function cancelInvite(inviteId: string) {
  await requireSuperUser();

  await db.delete(invites).where(eq(invites.id, inviteId));

  revalidatePath("/team");
  return { success: true };
}

export async function getPendingInvites() {
  await requireAnyRole();

  return await db
    .select({
      id: invites.id,
      name: invites.name,
      email: invites.email,
      role: invites.role,
      isAccepted: invites.isAccepted,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .where(eq(invites.isAccepted, false))
    .orderBy(invites.name);
}

export async function validateInviteToken(token: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  if (!invite) {
    return { valid: false, reason: "Invalid invitation link." };
  }

  if (invite.isAccepted) {
    return { valid: false, reason: "This invitation has already been accepted." };
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return { valid: false, reason: "This invitation link has expired." };
  }

  return { valid: true, invite };
}

export async function acceptInvite(data: unknown) {
  const parsed = AcceptInviteSchema.parse(data);

  // 1. Validate the invite token
  const validation = await validateInviteToken(parsed.token);
  if (!validation.valid || !validation.invite) {
    throw new Error(validation.reason || "Invalid invitation link.");
  }

  const { invite } = validation;

  // 2. Hash user's password
  const passwordHash = await bcrypt.hash(parsed.password, 12);

  // 3. Create the user in the database
  const [newUser] = await db
    .insert(users)
    .values({
      email: invite.email.toLowerCase(),
      name: invite.name,
      passwordHash,
      role: invite.role,
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  // 4. Mark invitation as accepted
  await db
    .update(invites)
    .set({
      isAccepted: true,
      acceptedAt: new Date(),
    })
    .where(eq(invites.id, invite.id));

  revalidatePath("/team");
  return newUser;
}
