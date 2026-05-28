import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getIntegration, googleConfigured } from "@/lib/google";
import JacquesCalendar from "@/components/settings/JacquesCalendar";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id) redirect("/login");
  if (role !== "super_user" && role !== "admin") redirect("/tasks");

  const integration = await getIntegration();

  return (
    <div className="h-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Jacques Calendar</h1>
        <p className="text-sm text-text-secondary">
          Live, read-only view of Jacques&apos;s Google Calendar
        </p>
      </div>

      <JacquesCalendar
        connected={!!integration}
        email={integration?.email ?? null}
        configured={googleConfigured()}
      />
    </div>
  );
}
