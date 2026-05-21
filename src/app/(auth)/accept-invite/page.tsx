"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { validateInviteToken, acceptInvite } from "@/actions/users";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { HemisphereMark } from "@/components/brand/Logo";

const PasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [reason, setReason] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Validate the token on mount
  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setReason("No invitation token was provided.");
        setIsValid(false);
        setChecking(false);
        return;
      }

      try {
        const res = await validateInviteToken(token);
        if (res.valid && res.invite) {
          setIsValid(true);
          setInviteData(res.invite);
        } else {
          setReason(res.reason || "Invalid invitation link.");
          setIsValid(false);
        }
      } catch (err) {
        setReason("Failed to validate invitation token.");
        setIsValid(false);
      } finally {
        setChecking(false);
      }
    }
    checkToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = PasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        password: fieldErrors.password?.[0] || "",
        confirmPassword: fieldErrors.confirmPassword?.[0] || "",
      });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Accept invite and create account
      await acceptInvite({
        token,
        password,
      });

      toast.success("Account created successfully! Logging you in...");

      // 2. Automatically log them in
      const result = await signIn("credentials", {
        email: inviteData.email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Auto-login failed. Please sign in manually.");
        router.push("/login");
      } else {
        router.push("/tasks");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to set up account.");
      setSubmitting(false);
    }
  }

  // Background Style using identical Mountain background for flawless aesthetic parity
  const bgStyle: React.CSSProperties = {
    backgroundImage: `url('/mountiankanban.jpeg')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  if (checking) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center relative text-white" style={bgStyle}>
        <div className="absolute inset-0 bg-slate-950/75 z-0" />
        <div className="z-10 flex flex-col items-center gap-4 bg-surface/30 backdrop-blur-xl border border-border/40 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
          <Loader2 className="animate-spin text-accent" size={32} />
          <p className="text-text-secondary font-medium">Validating invitation link...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center relative text-white" style={bgStyle}>
        <div className="absolute inset-0 bg-slate-950/75 z-0" />
        <div className="z-10 flex flex-col items-center gap-6 bg-surface/30 backdrop-blur-xl border border-danger/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center border border-danger/30 text-danger shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            <AlertCircle size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Invitation Error</h1>
            <p className="text-text-secondary text-sm mt-2">{reason}</p>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-surface-2 border border-border hover:bg-surface-2/80 text-text-primary px-4 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative text-white" style={bgStyle}>
      <div className="absolute inset-0 bg-slate-950/75 z-0" />
      <div className="z-10 w-full max-w-md px-4 py-12 flex flex-col items-center">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <HemisphereMark size={36} />
            <span className="text-2xl font-bold text-text-primary tracking-tight">
              Hemisphere
            </span>
          </div>
          <p className="text-text-secondary text-sm">
            Set up your password to activate your workspace account
          </p>
        </div>

        {/* Card */}
        <div className="w-full bg-surface/30 backdrop-blur-xl border border-border/40 p-8 rounded-2xl shadow-2xl">
          <div className="mb-6 pb-6 border-b border-border/40">
            <div className="text-[10px] text-accent uppercase font-bold tracking-widest mb-1.5">Invitation details</div>
            <div className="text-sm font-semibold text-text-primary">{inviteData.name}</div>
            <div className="text-xs text-text-secondary mt-0.5">{inviteData.email}</div>
            <div className="mt-2.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 border border-accent/30 text-accent capitalize">
                Role: {inviteData.role.replace("_", " ")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Choose Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface-2/40 border border-border/60 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent hover:bg-surface-2/60 focus:bg-surface-2/60 transition"
                style={{
                  borderColor: errors.password ? "var(--danger)" : "rgba(255, 255, 255, 0.1)",
                }}
              />
              {errors.password && (
                <p className="text-xs text-danger">{errors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-surface-2/40 border border-border/60 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent hover:bg-surface-2/60 focus:bg-surface-2/60 transition"
                style={{
                  borderColor: errors.confirmPassword ? "var(--danger)" : "rgba(255, 255, 255, 0.1)",
                }}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-danger">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent hover:bg-accent-hover text-white py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Setting up account...
                </>
              ) : (
                "Activate Account & Join"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
