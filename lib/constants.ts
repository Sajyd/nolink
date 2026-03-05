// Monetization
export const NL_TO_USD_CENTS = 2; // 1 NL = $0.02
export const NL_TO_EUR_CENTS = 2; // 1 NL = €0.02
export const MINIMUM_PAYOUT_NL = 500; // minimum 500 NL ($10.00) to request payout
export const PLATFORM_FEE_PERCENT = 30; // 30% platform fee on creator earnings
export const PAYOUT_HOLDING_DAYS = 30; // days after first earning before payout is allowed
export const SIGNUP_BONUS_NL = 50; // free NL granted on signup (goes to bonusBalance)

// fal.ai USD → Nolinks conversion rate (includes platform margin)
export const FAL_USD_TO_NL = 80;

// Replicate USD → Nolinks conversion rate (includes platform margin)
export const REPLICATE_USD_TO_NL = 80;
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

// Max workflow execution time per subscription tier
export const EXECUTION_TIMEOUT_MS: Record<string, number> = {
  FREE: 15 * 60 * 1000,
  STARTER: 15 * 60 * 1000,
  PRO: 30 * 60 * 1000,
  ENTERPRISE: 30 * 60 * 1000,
};

export const SUBSCRIPTION_PLANS = [
  {
    tier: "FREE" as const,
    name: "Free",
    nameKey: "plans.free",
    monthlyNolinks: 50,
    priceInCents: 0,
    features: ["50 Nolinks/month", "Run public workflows", "API access (pay per use)", "Basic support"],
    featureKeys: ["plans.feat50", "plans.featRunPublic", "plans.featApi", "plans.featBasicSupport"],
  },
  {
    tier: "STARTER" as const,
    name: "Starter",
    nameKey: "plans.starter",
    monthlyNolinks: 500,
    priceInCents: 999,
    features: ["500 Nolinks/month", "Create workflows", "API access (pay per use)", "Usage analytics", "Email support"],
    featureKeys: ["plans.feat500", "plans.featCreateWorkflows", "plans.featApi", "plans.featAnalytics", "plans.featEmailSupport"],
  },
  {
    tier: "PRO" as const,
    name: "Pro",
    nameKey: "plans.pro",
    monthlyNolinks: 2000,
    priceInCents: 2999,
    features: ["2,000 Nolinks/month", "Unlimited workflows", "API access (pay per use)", "Priority execution", "Withdraw earnings to bank", "Priority support"],
    featureKeys: ["plans.feat2000", "plans.featUnlimited", "plans.featApi", "plans.featPriority", "plans.featStripe", "plans.featPrioritySupport"],
  },
  {
    tier: "ENTERPRISE" as const,
    name: "Enterprise",
    nameKey: "plans.enterprise",
    monthlyNolinks: 10000,
    priceInCents: 9999,
    features: ["10,000 Nolinks/month", "Custom AI models", "API access (pay per use)", "Dedicated support", "Custom branding"],
    featureKeys: ["plans.feat10000", "plans.featCustomModels", "plans.featApi", "plans.featDedicatedSupport", "plans.featCustomBranding"],
  },
];
