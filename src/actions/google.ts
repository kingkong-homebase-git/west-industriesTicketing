"use server";

import { requireSuperUser } from "@/lib/require-role";
import { listCalendarEvents } from "@/lib/google";

// Super-user/admin only: read Jacques's calendar events for a date range.
export async function getJacquesCalendarEvents(timeMinISO: string, timeMaxISO: string) {
  await requireSuperUser();
  return listCalendarEvents(timeMinISO, timeMaxISO);
}
