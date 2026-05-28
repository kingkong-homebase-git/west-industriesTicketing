"use server";

import { requireSuperUser } from "@/lib/require-role";
import { createTestCalendarEvent } from "@/lib/google";

// Super-user/admin only: create a test event to verify the calendar connection.
export async function sendTestCalendarEvent() {
  await requireSuperUser();
  return createTestCalendarEvent();
}
