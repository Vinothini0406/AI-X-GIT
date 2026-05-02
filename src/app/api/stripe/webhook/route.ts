import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import {
  assertStripeWebhookSecret,
  fulfillCheckoutSession,
  getStripeClient,
  markCheckoutSessionFailed,
} from "@/server/billing/stripe";

export const runtime = "nodejs";

export const POST = async (request: NextRequest) => {
  const stripe = getStripeClient();
  let webhookSecret: string;

  try {
    webhookSecret = assertStripeWebhookSecret();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook secret is not configured.",
      },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid Stripe webhook payload.",
      },
      { status: 400 },
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    await fulfillCheckoutSession(session.id);
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object;
    await markCheckoutSessionFailed(session.id);
  }

  return NextResponse.json({ received: true });
};
