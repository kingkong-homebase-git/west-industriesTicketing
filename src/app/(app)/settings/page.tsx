import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getIntegration, googleConfigured } from "@/lib/google";
import GoogleCalendarCard from "@/components/settings/GoogleCalendarCard";

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
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary">Integrations & workspace configuration</p>
      </div>

      <div className="space-y-4">
        <GoogleCalendarCard
          connected={!!integration}
          email={integration?.email ?? null}
          configured={googleConfigured()}
        />
      </div>
    </div>
  );
}
