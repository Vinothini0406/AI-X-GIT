import Stripe from "stripe";

import { env } from "@/env";
import { db } from "@/server/db";

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  amountInPaise: true,
  currency: true,
  issuedAt: true,
} as const;

export const getStripeClient = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.",
    );
  }

  if (!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY)) {
    throw new Error(
      'Invalid STRIPE_SECRET_KEY. It must start with "sk_test_" or "sk_live_" and must not contain extra quotes.',
    );
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
};

export const assertStripeWebhookSecret = () => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret is not configured.");
  }

  if (!env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
    throw new Error(
      'Invalid STRIPE_WEBHOOK_SECRET. It must start with "whsec_".',
    );
  }

  return env.STRIPE_WEBHOOK_SECRET;
};

export const fulfillCheckoutSession = async (
  sessionId: string,
  options?: { expectedUserId?: string },
) => {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  const paymentId = session.metadata?.paymentId ?? session.client_reference_id;
  if (!paymentId) {
    throw new Error("Stripe session is missing payment metadata.");
  }

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      Invoice: {
        select: invoiceSelect,
      },
    },
  });

  if (!payment) {
    throw new Error("Payment record was not found.");
  }

  if (options?.expectedUserId && payment.userId !== options.expectedUserId) {
    throw new Error("Payment session does not belong to the current user.");
  }

  const isPaid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";

  if (!isPaid) {
    return {
      status: "PENDING" as const,
      paymentId: payment.id,
      invoice: payment.Invoice,
      message: "Stripe Checkout has not reported a completed payment yet.",
    };
  }

  if (payment.status !== "SUCCESS" || payment.providerRef !== session.id) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        providerRef: session.id,
      },
    });
  }

  if (payment.Invoice) {
    return {
      status: "SUCCESS" as const,
      paymentId: payment.id,
      invoice: payment.Invoice,
      message: "Payment already fulfilled.",
    };
  }

  const invoiceNumber = `INV-INR-${new Date().getUTCFullYear()}-${payment.id
    .slice(-8)
    .toUpperCase()}`;

  try {
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        userId: payment.userId,
        projectId: payment.projectId,
        paymentId: payment.id,
        amountInPaise: payment.amountInPaise,
        currency: payment.currency,
        status: "PAID",
      },
      select: invoiceSelect,
    });

    return {
      status: "SUCCESS" as const,
      paymentId: payment.id,
      invoice,
      message: "Payment fulfilled.",
    };
  } catch (error) {
    const invoice = await db.invoice.findUnique({
      where: { paymentId: payment.id },
      select: invoiceSelect,
    });

    if (invoice) {
      return {
        status: "SUCCESS" as const,
        paymentId: payment.id,
        invoice,
        message: "Payment already fulfilled.",
      };
    }

    throw error;
  }
};

export const markCheckoutSessionFailed = async (sessionId: string) => {
  const payment = await db.payment.findFirst({
    where: {
      providerRef: sessionId,
      status: "PENDING",
    },
    select: {
      id: true,
    },
  });

  if (!payment) {
    return { status: "IGNORED" as const };
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED" },
  });

  return {
    status: "FAILED" as const,
    paymentId: payment.id,
  };
};
