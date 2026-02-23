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

const AUTH_NOTIFY_SUBJECT = "User Login Alert";
const MAX_SEND_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const getEventLabel = (eventType: AuthEventType) =>
  eventType === "signup" ? "Sign up" : "Sign in";

export async function sendAuthNotificationEmail(
  input: SendAuthNotificationInput,
) {
  if (!env.RESEND_API_KEY) {
    console.warn(
      "[auth-notify] RESEND_API_KEY is missing. Auth notification email was skipped.",
    );
    return;
  }

  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.email);
  const safeUserId = escapeHtml(input.userId);
  const safeEventType = escapeHtml(getEventLabel(input.eventType));
  const safeTime = escapeHtml(input.occurredAt.toISOString());
  const safeIp = escapeHtml(input.ipAddress ?? "Unavailable");
  const safeUserAgent = escapeHtml(input.userAgent ?? "Unavailable");
  const text = [
    `User email address: ${input.email}`,
    `User ID: ${input.userId}`,
    `Event type: ${getEventLabel(input.eventType)}`,
    `Timestamp: ${input.occurredAt.toISOString()}`,
    `Name: ${input.name}`,
    `IP Address: ${input.ipAddress ?? "Unavailable"}`,
    `User Agent: ${input.userAgent ?? "Unavailable"}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin-bottom:8px;">User Login Alert</h2>
      <p style="margin-top:0;">A user authentication event was received from Clerk.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>User email address</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeEmail}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>User ID</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeUserId}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Event type</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeEventType}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Timestamp</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeTime}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Name</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>IP Address</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeIp}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>User Agent</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeUserAgent}</td></tr>
        </tbody>
      </table>
    </div>
  `;

  const from = env.AUTH_NOTIFY_FROM ?? "onboarding@resend.dev";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [env.AUTH_NOTIFY_TO],
      subject: AUTH_NOTIFY_SUBJECT,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `[auth-notify] Failed to send email (${response.status}): ${details}`,
    );
  }
}

export async function sendAuthNotificationEmailWithRetry(
  input: SendAuthNotificationInput,
  maxAttempts = MAX_SEND_ATTEMPTS,
) {
  const attempts = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await sendAuthNotificationEmail(input);
      return;
    } catch (error) {
      console.error(
        `[auth-notify] Attempt ${attempt}/${attempts} failed.`,
        error,
      );

      if (attempt === attempts) {
        throw error;
      }

      await wait(BASE_RETRY_DELAY_MS * attempt);
    }
  }
}
