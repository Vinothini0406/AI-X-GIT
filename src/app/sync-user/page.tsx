import { auth, clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { sendAuthNotificationEmail } from "@/server/notifications/auth-notification";

export default async function Page() {
  const { userId } = await auth();

  if (!userId) throw new Error("User not found");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const displayName =
    fullName.length > 0
      ? fullName
      : user.username ?? user.emailAddresses[0]?.emailAddress ?? "User";
  const primaryEmail = user.emailAddresses[0]?.emailAddress ?? "unknown@email.com";
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

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  try {
    await sendAuthNotificationEmail({
      eventType: existingUser ? "login" : "signup",
      name: displayName,
      email: primaryEmail,
      userId,
      occurredAt: new Date(),
      ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
      userAgent: requestHeaders.get("user-agent"),
    });
  } catch (error) {
    console.error(error);
  }

  redirect("/dashboard");
}
