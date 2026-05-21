import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;

  const isPublic =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/accept-invite") ||
    nextUrl.pathname.startsWith("/api/auth");

  if (isPublic) return NextResponse.next();

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Team management page (/team) is super_user/admin only. NOTE: must NOT match
  // /team-board (the org-wide board, open to all roles) — so check exact path,
  // not startsWith("/team").
  const role = (session?.user as any)?.role;
  if (
    (nextUrl.pathname === "/team" || nextUrl.pathname.startsWith("/team/")) &&
    role !== "super_user" &&
    role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/tasks", nextUrl));
  }

  // Admin section: super_user only
  if (nextUrl.pathname.startsWith("/admin") && role !== "super_user") {
    return NextResponse.redirect(new URL("/tasks", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
