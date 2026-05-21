"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { requestPasswordReset } from "@/actions/users";
import { HemisphereMark } from "@/components/brand/Logo";
import { ArrowLeft, MailCheck } from "lucide-react";

const Schema = z.object({ email: z.string().email("Invalid email address") });

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = Schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset({ email });
      setSent(true);
    } catch {
      // Generic — never reveal whether the email exists.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <HemisphereMark size={36} />
            <span className="text-2xl font-bold text-text-primary tracking-tight">Hemisphere</span>
          </div>
          <p className="text-text-secondary text-sm">Reset your password</p>
        </div>

        <div className="rounded-2xl border p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-success/10 border border-success/30 text-success flex items-center justify-center">
                <MailCheck size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">Check your email</h1>
                <p className="text-text-secondary text-sm mt-2">
                  If an account exists for <span className="text-text-primary">{email}</span>, we&apos;ve sent a
                  password reset link. It expires in 1 hour.
                </p>
              </div>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover hover:underline">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-text-secondary">
                Enter your account email and we&apos;ll send you a link to reset your password.
              </p>
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm border text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent transition"
                  style={{ background: "var(--surface-2)", borderColor: error ? "var(--danger)" : "var(--border)" }}
                />
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: loading ? "var(--accent-hover)" : "var(--accent)" }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
                  <ArrowLeft size={12} /> Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
