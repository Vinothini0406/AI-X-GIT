import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { syncAuthenticatedUser } from "@/server/auth/sync-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Your session is still being prepared. Please try again." },
      { status: 401 },
    );
  }

  try {
    const user = await syncAuthenticatedUser({
      requestHeaders: request.headers,
      userId,
    });

    return NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        id: user.id,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("[sync-user] Failed to sync authenticated user.", error);

    return NextResponse.json(
      { error: "We could not prepare your workspace. Please try again." },
      { status: 500 },
    );
  }
}
