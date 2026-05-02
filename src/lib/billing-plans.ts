export const billingPlans = {
  basic: {
    key: "basic",
    name: "Basic",
    eyebrow: "Stripe minimum",
    amountInPaise: 5000,
    description:
      "A lightweight plan for trying repository intelligence on a small project, priced to clear Stripe's minimum charge.",
    benefits: [
      "One active repository workspace",
      "Core commit summary workflow",
      "Repository-aware AI questions",
      "Standard billing history",
    ],
  },
  premium: {
    key: "premium",
    name: "Early Access Premium",
    eyebrow: "Best value",
    amountInPaise: 49900,
    description:
      "Full early access for teams that want richer project context and priority workflows.",
    benefits: [
      "Unlimited repository workspaces",
      "Expanded AI context for commits and Q&A",
      "Priority sync and summarization flow",
      "Team-ready billing and invoice history",
    ],
  },
} as const;

export type BillingPlanKey = keyof typeof billingPlans;

export const billingPlanKeys = Object.keys(billingPlans) as BillingPlanKey[];
