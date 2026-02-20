// Monetization
export const NL_TO_USD_CENTS = 2; // 1 NL = $0.02
export const CREATOR_COMMISSION_RATE = 0.7; // 70% to creator
export const MINIMUM_PAYOUT_NL = 100; // minimum 100 NL ($4.00) to request payout
export const PAYOUT_ELIGIBLE_TIERS = ["PRO", "ENTERPRISE"] as const;

// Workflow limits per subscription tier
export const WORKFLOW_LIMITS: Record<string, number> = {
  FREE: 0,
  STARTER: 10,
  PRO: 999999,
  ENTERPRISE: 999999,
};

export const CREDIT_PACKAGES = [
  { id: "pack_100", nolinks: 100, priceInCents: 499, label: "100 Nolinks" },
  { id: "pack_500", nolinks: 500, priceInCents: 1999, label: "500 Nolinks" },
  { id: "pack_1200", nolinks: 1200, priceInCents: 3999, label: "1,200 Nolinks" },
] as const;

export const SUBSCRIPTION_PLANS = [
  {
    tier: "FREE" as const,
    name: "Free",
    monthlyNolinks: 50,
    priceInCents: 0,
    features: ["50 Nolinks/month", "Run public workflows", "Basic support"],
  },
  {
    tier: "STARTER" as const,
    name: "Starter",
    monthlyNolinks: 500,
    priceInCents: 999,
    features: ["500 Nolinks/month", "Create workflows", "Usage analytics", "Email support"],
  },
  {
    tier: "PRO" as const,
    name: "Pro",
    monthlyNolinks: 2000,
    priceInCents: 2999,
    features: ["2,000 Nolinks/month", "Unlimited workflows", "Priority execution", "Stripe Connect earnings", "Priority support"],
  },
  {
    tier: "ENTERPRISE" as const,
    name: "Enterprise",
    monthlyNolinks: 10000,
    priceInCents: 9999,
    features: ["10,000 Nolinks/month", "Custom AI models", "API access", "Dedicated support", "Custom branding"],
  },
];
