"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { toast } from "sonner";
import { validateResetToken, resetPassword } from "@/actions/users";
import { HemisphereMark } from "@/components/brand/Logo";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

const Schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function ResetContent() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [reason, setReason] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function check() {
      if (!token) {
        setReason("No reset token was provided.");
        setValid(false);
        setChecking(false);
        return;
      }
      try {
        const res = await validateResetToken(token);
        setValid(res.valid);
        if (!res.valid) setReason(res.reason || "Invalid reset link.");
      } catch {
        setValid(false);
        setReason("Failed to validate reset link.");
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = Schema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ password: f.password?.[0] || "", confirmPassword: f.confirmPassword?.[0] || "" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPassword({ token, password });
      if (!res.ok) {
        toast.error(res.error);
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const card = "rounded-2xl border p-8";
  const cardStyle = { background: "var(--surface)", borderColor: "var(--border)" } as const;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <HemisphereMark size={36} />
            <span className="text-2xl font-bold text-text-primary tracking-tight">Hemisphere</span>
          </div>
          <p className="text-text-secondary text-sm">Choose a new password</p>
        </div>

        {checking ? (
          <div className={card} style={cardStyle}>
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="animate-spin text-accent" size={28} />
              <p className="text-text-secondary text-sm">Validating reset link…</p>
            </div>
          </div>
        ) : !valid ? (
          <div className={card} style={cardStyle}>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-danger/10 border border-danger/30 text-danger flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">Reset link problem</h1>
                <p className="text-text-secondary text-sm mt-2">{reason}</p>
              </div>
              <Link href="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover hover:underline">
                Request a new link
              </Link>
            </div>
          </div>
        ) : done ? (
          <div className={card} style={cardStyle}>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-success/10 border border-success/30 text-success flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">Password updated</h1>
                <p className="text-text-secondary text-sm mt-2">Redirecting you to sign in…</p>
              </div>
            </div>
          </div>
        ) : (
          <div className={card} style={cardStyle}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">New password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition"
                  style={{ background: "var(--surface-2)", borderColor: errors.password ? "var(--danger)" : "var(--border)" }}
                />
                {errors.password && <p className="text-xs text-danger">{errors.password}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">Confirm password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition"
                  style={{ background: "var(--surface-2)", borderColor: errors.confirmPassword ? "var(--danger)" : "var(--border)" }}
                />
                {errors.confirmPassword && <p className="text-xs text-danger">{errors.confirmPassword}</p>}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: submitting ? "var(--accent-hover)" : "var(--accent)" }}
              >
                {submitting ? "Updating…" : "Update password"}
              </button>
              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
                  <ArrowLeft size={12} /> Back to sign in
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetContent />
    </Suspense>
  );
}
