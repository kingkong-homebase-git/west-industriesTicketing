"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Link2, Unlink, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { sendTestCalendarEvent } from "@/actions/google";

interface GoogleCalendarCardProps {
  connected: boolean;
  email: string | null;
  configured: boolean;
}

export default function GoogleCalendarCard({
  connected,
  email,
  configured,
}: GoogleCalendarCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleTest = async () => {
    setBusy(true);
    try {
      const res = await sendTestCalendarEvent();
      if (res.ok) {
        toast.success("Test event created on your calendar 🎉");
        if (res.link) window.open(res.link, "_blank", "noopener,noreferrer");
      } else {
        toast.error(res.error || "Test failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Test failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/google/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Google Calendar disconnected");
      router.refresh();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 max-w-xl">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Calendar size={22} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary">
            Google Calendar
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            Sync your tasks with deadlines to your Google Calendar as events.
          </p>

          {!configured ? (
            <p className="mt-4 text-sm text-warning">
              Not configured on the server (missing Google credentials).
            </p>
          ) : connected ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-success">
                <Check size={16} />
                <span>
                  Connected{email ? ` as ${email}` : ""}.
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleTest}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  <CalendarCheck size={15} />
                  {busy ? "Working…" : "Send test event"}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-danger hover:border-danger/50 transition-colors disabled:opacity-50"
                >
                  <Unlink size={15} />
                  {busy ? "…" : "Disconnect"}
                </button>
              </div>
            </div>
          ) : (
            <a
              href="/api/google/connect"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              <Link2 size={16} />
              Connect Google Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
