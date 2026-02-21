import Stripe from "stripe";
import { CREDIT_PACKAGES, SUBSCRIPTION_PLANS } from "./constants";
import prisma from "./prisma";

export { CREDIT_PACKAGES } from "./constants";
export { SUBSCRIPTION_PLANS } from "./constants";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

export function getStripeClient() {
  return getStripe();
}

// ── Customer management ─────────────────────────────────────────

export async function getOrCreateStripeCustomer(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ── Credit purchase checkout ────────────────────────────────────

export async function createCheckoutSession(
  customerId: string,
  packageId: string,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = getStripe();
  const pack = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pack) throw new Error("Invalid package");

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: pack.label },
          unit_amount: pack.priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: { packageId: pack.id, nolinks: String(pack.nolinks) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

// ── Subscription checkout ───────────────────────────────────────

export async function createSubscriptionCheckout(
  customerId: string,
  tier: string,
  userId: string,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = getStripe();
  const plan = SUBSCRIPTION_PLANS.find((p) => p.tier === tier);
  if (!plan || plan.priceInCents === 0) throw new Error("Invalid plan");

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `nolink.ai ${plan.name} Plan`,
            description: `${plan.monthlyNolinks} Nolinks/month + ${plan.features.slice(1).join(", ")}`,
          },
          unit_amount: plan.priceInCents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "subscription",
      tier: plan.tier,
      userId,
      monthlyNolinks: String(plan.monthlyNolinks),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

// ── Stripe Connect ──────────────────────────────────────────────

export async function createConnectAccount(userId: string, email: string) {
  const stripe = getStripe();

  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectId: account.id },
  });

  return account;
}

export async function createConnectOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  const stripe = getStripe();

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return link.url;
}

export async function checkConnectStatus(accountId: string) {
  const stripe = getStripe();

  const account = await stripe.accounts.retrieve(accountId);

  const isOnboarded =
    account.details_submitted === true &&
    account.charges_enabled === true &&
    account.payouts_enabled === true;

  return {
    isOnboarded,
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  };
}

export async function markConnectOnboarded(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectOnboarded: true },
  });
}

export async function createConnectLoginLink(accountId: string) {
  const stripe = getStripe();
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
}

// ── Payouts via Stripe Transfer ─────────────────────────────────

export async function executeStripePayout(
  payoutId: string,
  connectAccountId: string,
  amountCents: number
) {
  const stripe = getStripe();

  try {
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "usd",
      destination: connectAccountId,
      metadata: { payoutId },
    });

    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        stripeTransferId: transfer.id,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return { success: true, transferId: transfer.id };
  } catch (error) {
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: "FAILED",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Refund the earned balance since transfer failed
    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (payout) {
      await prisma.user.update({
        where: { id: payout.userId },
        data: { earnedBalance: { increment: payout.amountNL } },
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
