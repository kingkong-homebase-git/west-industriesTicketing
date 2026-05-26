import { Resend } from "resend";

interface SendInviteEmailParams {
  toEmail: string;
  inviteeName: string;
  inviterName: string;
  inviteLink: string;
  personalMessage?: string | null;
}

export interface SendEmailResult {
  delivered: boolean;
  error?: string;
}

// Env is read at call time (not module load) so standalone scripts (e.g. the
// SLA cron) that load .env.local after import still get the key.
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}
// Resend requires a verified domain to send to arbitrary recipients. Without
// one, use "onboarding@resend.dev" (Resend's shared sender) which can only
// deliver to your own account email — fine for testing.
function getEmailFrom(): string {
  return process.env.EMAIL_FROM || "Hemisphere <onboarding@resend.dev>";
}

function buildInviteHtml({
  inviteeName,
  inviterName,
  inviteLink,
  personalMessage,
}: SendInviteEmailParams): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're invited to Hemisphere</title>
        <style>
          body {
            background-color: #0b0f19;
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            background-color: #0b0f19;
            width: 100%;
            table-layout: fixed;
            padding: 40px 0;
          }
          .container {
            max-width: 580px;
            margin: 0 auto;
            background: rgba(17, 24, 39, 0.6);
            border: 1px solid rgba(249, 115, 22, 0.2);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .header {
            padding: 32px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
            background: rgba(14, 19, 32, 0.8);
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.025em;
            text-shadow: 0 0 12px rgba(249, 115, 22, 0.4);
          }
          .logo-accent {
            color: #f97316;
          }
          .content {
            padding: 40px 32px;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 16px;
            color: #ffffff;
            text-align: center;
          }
          p {
            font-size: 15px;
            line-height: 24px;
            color: #9ca3af;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .message-box {
            background: rgba(255, 255, 255, 0.03);
            border-left: 3px solid #f97316;
            border-radius: 4px;
            padding: 16px;
            margin: 24px 0;
            font-style: italic;
            color: #d1d5db;
          }
          .cta-container {
            text-align: center;
            margin: 32px 0;
          }
          .button {
            display: inline-block;
            background-color: #f97316;
            color: #ffffff !important;
            font-weight: 600;
            font-size: 15px;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);
            transition: all 0.2s ease;
          }
          .footer {
            padding: 24px 32px;
            background: rgba(14, 19, 32, 0.8);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
            font-size: 12px;
            color: #4b5563;
          }
          .footer a {
            color: #f97316;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">
                Hemi<span class="logo-accent">sphere</span>
              </div>
            </div>
            <div class="content">
              <h1>You're Invited!</h1>
              <p>Hello ${inviteeName},</p>
              <p><strong>${inviterName}</strong> has invited you to join the <strong>Hemisphere Workspace</strong> as a team member.</p>
              ${
                personalMessage
                  ? `<div class="message-box">"${personalMessage}"</div>`
                  : ""
              }
              <p>Click the button below to accept your invitation and set up your account. This invitation link is secure and will expire in 48 hours.</p>
              <div class="cta-container">
                <a href="${inviteLink}" class="button" target="_blank">Accept Invitation</a>
              </div>
              <p>Or copy and paste this link into your web browser:</p>
              <p style="word-break: break-all; font-size: 13px; color: #f97316;">${inviteLink}</p>
            </div>
            <div class="footer">
              This invitation was sent by <a href="${process.env.AUTH_URL || "http://localhost:3000"}">Hemisphere</a>.<br>
              If you were not expecting this invitation, you can safely ignore this email.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildInviteText({
  inviteeName,
  inviterName,
  inviteLink,
  personalMessage,
}: SendInviteEmailParams): string {
  return [
    `Hello ${inviteeName},`,
    "",
    `${inviterName} has invited you to join the Hemisphere Workspace.`,
    personalMessage ? `\nMessage: "${personalMessage}"\n` : "",
    "Accept your invitation (link expires in 48 hours):",
    inviteLink,
    "",
    "If you were not expecting this invitation, you can safely ignore this email.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

interface SendPasswordResetParams {
  toEmail: string;
  name: string;
  resetLink: string;
}

function buildResetHtml({ name, resetLink }: SendPasswordResetParams): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reset your Hemisphere password</title></head>
      <body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="background:#0b0f19;padding:40px 0;">
          <div style="max-width:580px;margin:0 auto;background:rgba(17,24,39,0.6);border:1px solid rgba(249,115,22,0.25);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <div style="padding:32px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;background:rgba(14,19,32,0.8);">
              <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.025em;">Hemi<span style="color:#f97316;">sphere</span></div>
            </div>
            <div style="padding:40px 32px;">
              <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#fff;text-align:center;">Reset your password</h1>
              <p style="font-size:15px;line-height:24px;color:#9ca3af;margin:0 0 20px;">Hello ${name},</p>
              <p style="font-size:15px;line-height:24px;color:#9ca3af;margin:0 0 20px;">We received a request to reset your Hemisphere password. Click the button below to choose a new one. This link is secure and expires in 1 hour.</p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetLink}" style="display:inline-block;background:#f97316;color:#fff;font-weight:600;font-size:15px;padding:14px 32px;text-decoration:none;border-radius:8px;box-shadow:0 4px 14px rgba(249,115,22,0.4);" target="_blank">Reset Password</a>
              </div>
              <p style="font-size:15px;line-height:24px;color:#9ca3af;margin:0 0 8px;">Or paste this link into your browser:</p>
              <p style="word-break:break-all;font-size:13px;color:#f97316;margin:0;">${resetLink}</p>
            </div>
            <div style="padding:24px 32px;background:rgba(14,19,32,0.8);border-top:1px solid rgba(255,255,255,0.05);text-align:center;font-size:12px;color:#4b5563;">
              If you didn't request this, you can safely ignore this email — your password won't change.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Sends a password-reset email via Resend. Never throws — returns a delivery
 * result. Always logs the reset link to the console as a fallback.
 */
export async function sendPasswordResetEmail(
  params: SendPasswordResetParams
): Promise<SendEmailResult> {
  const { toEmail, name, resetLink } = params;

  console.log("\n========================================================");
  console.log(`🔒 PASSWORD RESET FOR: ${toEmail}`);
  console.log(`👤 NAME: ${name}`);
  console.log(`🔑 RESET LINK: ${resetLink}`);
  console.log("========================================================\n");

  const resend = getResend();
  if (!resend) {
    console.log("ℹ️ RESEND_API_KEY not set — reset email not sent. Link logged above.");
    return { delivered: false, error: "resend_api_key_missing" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: toEmail,
      subject: "Reset your Hemisphere password",
      html: buildResetHtml(params),
      text: `Hello ${name},\n\nReset your Hemisphere password (link expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
    });
    if (error) {
      console.error("[email] Resend returned an error:", error);
      return { delivered: false, error: error.message };
    }
    return { delivered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send reset email:", message);
    return { delivered: false, error: message };
  }
}

/**
 * Sends the invite email via Resend. Never throws — returns a delivery result
 * so callers can complete the invite flow even when email fails. Always logs
 * the invite to the console as a fallback / audit trail.
 */
export async function sendInviteEmail(
  params: SendInviteEmailParams
): Promise<SendEmailResult> {
  const { toEmail, inviteeName, inviteLink, personalMessage } = params;

  // Always log locally so the accept link is recoverable even if delivery fails.
  console.log("\n========================================================");
  console.log(`✉️ INVITATION FOR: ${toEmail}`);
  console.log(`👤 INVITEE NAME: ${inviteeName}`);
  console.log(`🔑 SECURE ACCEPT LINK: ${inviteLink}`);
  if (personalMessage) console.log(`💬 MESSAGE: "${personalMessage}"`);
  console.log("========================================================\n");

  const resend = getResend();
  if (!resend) {
    console.log(
      "ℹ️ RESEND_API_KEY not set — email not sent. Invite link logged above."
    );
    return { delivered: false, error: "resend_api_key_missing" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: toEmail,
      subject: "You've been invited to join Hemisphere",
      html: buildInviteHtml(params),
      text: buildInviteText(params),
    });

    if (error) {
      console.error("[email] Resend returned an error:", error);
      return { delivered: false, error: error.message };
    }
    return { delivered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send invite email:", message);
    return { delivered: false, error: message };
  }
}

// ─── Task notifications (assignment / urgent / SLA reminders) ─────────────────
export interface TaskEmailParams {
  toEmail: string;
  recipientName?: string | null;
  subject: string;
  heading: string;
  intro: string;
  taskTitle: string;
  taskMeta?: string | null;
  ctaUrl: string;
  ctaLabel?: string;
  accent?: string; // bar/title accent colour
}

function buildTaskEmailHtml(p: TaskEmailParams): string {
  const accent = p.accent || "#f97316";
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${p.subject}</title></head>
      <body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="background:#0b0f19;padding:40px 0;">
          <div style="max-width:580px;margin:0 auto;background:rgba(17,24,39,0.6);border:1px solid rgba(249,115,22,0.25);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <div style="padding:32px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;background:rgba(14,19,32,0.8);">
              <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.025em;">Hemi<span style="color:#f97316;">sphere</span></div>
            </div>
            <div style="padding:40px 32px;">
              <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#fff;">${p.heading}</h1>
              <p style="font-size:15px;line-height:24px;color:#9ca3af;margin:0 0 20px;">${p.recipientName ? `Hello ${p.recipientName},` : "Hello,"}</p>
              <p style="font-size:15px;line-height:24px;color:#9ca3af;margin:0 0 20px;">${p.intro}</p>
              <div style="background:rgba(255,255,255,0.03);border-left:3px solid ${accent};border-radius:4px;padding:16px;margin:24px 0;">
                <div style="font-size:16px;font-weight:600;color:#fff;">${p.taskTitle}</div>
                ${p.taskMeta ? `<div style="font-size:13px;color:#9ca3af;margin-top:6px;">${p.taskMeta}</div>` : ""}
              </div>
              <div style="text-align:center;margin:32px 0;">
                <a href="${p.ctaUrl}" style="display:inline-block;background:#f97316;color:#fff;font-weight:600;font-size:15px;padding:14px 32px;text-decoration:none;border-radius:8px;box-shadow:0 4px 14px rgba(249,115,22,0.4);" target="_blank">${p.ctaLabel || "Open Hemisphere"}</a>
              </div>
            </div>
            <div style="padding:24px 32px;background:rgba(14,19,32,0.8);border-top:1px solid rgba(255,255,255,0.05);text-align:center;font-size:12px;color:#4b5563;">
              You're receiving this because you're a member of the Hemisphere workspace.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildTaskEmailText(p: TaskEmailParams): string {
  return [
    p.recipientName ? `Hello ${p.recipientName},` : "Hello,",
    "",
    p.intro,
    "",
    `Task: ${p.taskTitle}`,
    p.taskMeta ? p.taskMeta : "",
    "",
    `${p.ctaLabel || "Open Hemisphere"}: ${p.ctaUrl}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Sends a task-related notification (assignment / urgent / SLA). Never throws —
 * returns a delivery result and logs to the console as a fallback.
 */
export async function sendTaskNotificationEmail(
  params: TaskEmailParams
): Promise<SendEmailResult> {
  console.log(`✉️ [task-email] "${params.subject}" -> ${params.toEmail}`);

  const resend = getResend();
  if (!resend) {
    console.log("ℹ️ RESEND_API_KEY not set — task email not sent.");
    return { delivered: false, error: "resend_api_key_missing" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: params.toEmail,
      subject: params.subject,
      html: buildTaskEmailHtml(params),
      text: buildTaskEmailText(params),
    });
    if (error) {
      console.error("[email] Resend returned an error:", error);
      return { delivered: false, error: error.message };
    }
    return { delivered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send task email:", message);
    return { delivered: false, error: message };
  }
}
