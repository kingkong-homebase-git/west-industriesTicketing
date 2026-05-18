import nodemailer from "nodemailer";

interface SendInviteEmailParams {
  toEmail: string;
  inviteeName: string;
  inviterName: string;
  inviteLink: string;
  personalMessage?: string | null;
}

export async function sendInviteEmail({
  toEmail,
  inviteeName,
  inviterName,
  inviteLink,
  personalMessage,
}: SendInviteEmailParams) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"West Industries" <no-reply@westindustries.com>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're invited to West Industries</title>
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
            border: 1px solid rgba(59, 130, 246, 0.2);
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
            text-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
          }
          .logo-accent {
            color: #3b82f6;
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
            border-left: 3px solid #3b82f6;
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
            background-color: #3b82f6;
            color: #ffffff !important;
            font-weight: 600;
            font-size: 15px;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
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
            color: #3b82f6;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">
                West <span class="logo-accent">Industries</span>
              </div>
            </div>
            <div class="content">
              <h1>You're Invited!</h1>
              <p>Hello ${inviteeName},</p>
              <p><strong>${inviterName}</strong> has invited you to join the <strong>West Industries Workspace</strong> as a team member.</p>
              
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
              <p style="word-break: break-all; font-size: 13px; color: #3b82f6;">${inviteLink}</p>
            </div>
            <div class="footer">
              This invitation was sent by <a href="${process.env.AUTH_URL || "http://localhost:3000"}">West Industries App</a>.<br>
              If you were not expecting this invitation, you can safely ignore this email.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  // Always log the styled email locally to terminal for seamless developer visibility
  console.log("\n========================================================");
  console.log(`✉️ INVITATION SENT TO: ${toEmail}`);
  console.log(`👤 INVITEE NAME: ${inviteeName}`);
  console.log(`🔑 SECURE ACCEPT LINK: ${inviteLink}`);
  if (personalMessage) console.log(`💬 MESSAGE: "${personalMessage}"`);
  console.log("========================================================\n");

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log("ℹ️ SMTP environment variables are not fully configured. Email was logged to console successfully.");
    return;
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  // Send the email
  await transporter.sendMail({
    from: smtpFrom,
    to: toEmail,
    subject: `You've been invited to join West Industries`,
    html: htmlContent,
  });
}
