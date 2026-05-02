import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { db } from "@/server/db";
import { sendAuthNotificationEmail } from "@/server/notifications/auth-notification";

interface SyncAuthenticatedUserInput {
  userId: string;
  requestHeaders?: Headers;
}

interface SyncedUser {
  email: string;
  eventType: "login" | "signup";
  id: string;
  name: string;
}

export async function syncAuthenticatedUser({
  userId,
  requestHeaders,
}: SyncAuthenticatedUserInput): Promise<SyncedUser> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const fullName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName =
    fullName.length > 0
      ? fullName
      : (user.username ?? user.emailAddresses[0]?.emailAddress ?? "User");
  const primaryEmail =
    user.emailAddresses[0]?.emailAddress ?? "unknown@email.com";
  const existingUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  await db.user.upsert({
    where: { id: userId },
    update: {
      name: displayName,
      updatedAt: new Date(),
    },
    create: {
      id: userId,
      name: displayName,
      updatedAt: new Date(),
    },
  });

  const forwardedFor = requestHeaders?.get("x-forwarded-for");
  const eventType = existingUser ? "login" : "signup";

  try {
    await sendAuthNotificationEmail({
      email: primaryEmail,
      eventType,
      ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
      name: displayName,
      occurredAt: new Date(),
      userAgent: requestHeaders?.get("user-agent"),
      userId,
    });
  } catch (error) {
    console.error("[sync-user] Auth notification email failed.", error);
  }

  return {
    email: primaryEmail,
    eventType,
    id: userId,
    name: displayName,
  };
}
