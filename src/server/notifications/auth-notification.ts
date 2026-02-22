import "server-only";

import { env } from "@/env";

type AuthEventType = "login" | "signup";

interface SendAuthNotificationInput {
  eventType: AuthEventType;
  name: string;
  email: string;
  userId: string;
  occurredAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export async function sendAuthNotificationEmail(
  input: SendAuthNotificationInput,
) {
  if (!env.RESEND_API_KEY) {
    console.warn(
      "[auth-notify] RESEND_API_KEY is missing. Auth notification email was skipped.",
    );
    return;
  }

  const subjectPrefix = input.eventType === "signup" ? "New Signup" : "User Login";
  const subject = `[Dionysus] ${subjectPrefix}: ${input.name}`;

  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.email);
  const safeUserId = escapeHtml(input.userId);
  const safeEventType = escapeHtml(input.eventType.toUpperCase());
  const safeTime = escapeHtml(input.occurredAt.toISOString());
  const safeIp = escapeHtml(input.ipAddress ?? "Unavailable");
  const safeUserAgent = escapeHtml(input.userAgent ?? "Unavailable");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin-bottom:8px;">Dionysus Authentication Event</h2>
      <p style="margin-top:0;">A user has completed an authentication action.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Event</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeEventType}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Name</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Email</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeEmail}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>User ID</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeUserId}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Occurred At (UTC)</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeTime}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>IP Address</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeIp}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>User Agent</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeUserAgent}</td></tr>
        </tbody>
      </table>
    </div>
  `;

  const from = env.AUTH_NOTIFY_FROM ?? "Dionysus Auth <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [env.AUTH_NOTIFY_TO],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `[auth-notify] Failed to send email (${response.status}): ${details}`,
    );
  }
}
