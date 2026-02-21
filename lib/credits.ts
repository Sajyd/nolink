import prisma from "./prisma";
import {
  CREATOR_COMMISSION_RATE,
  NL_TO_USD_CENTS,
  MINIMUM_PAYOUT_NL,
  PAYOUT_ELIGIBLE_TIERS,
} from "./constants";

// ── Balance helpers ─────────────────────────────────────────────

export function totalBalance(purchased: number, earned: number) {
  return purchased + earned;
}

export function nlToUsdCents(nl: number) {
  return nl * NL_TO_USD_CENTS;
}

export function nlToUsdString(nl: number) {
  return `$${(nlToUsdCents(nl) / 100).toFixed(2)}`;
}

// ── Check balance ───────────────────────────────────────────────

export async function checkBalance(userId: string, cost: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { purchasedBalance: true, earnedBalance: true },
  });
  if (!user) return false;
  return totalBalance(user.purchasedBalance, user.earnedBalance) >= cost;
}

// ── Deduct credits (purchased-first strategy) ───────────────────

export async function deductCredits(
  userId: string,
  workflowId: string,
  cost: number
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || totalBalance(user.purchasedBalance, user.earnedBalance) < cost) {
    throw new Error("Insufficient Nolinks balance");
  }

  // Purchased-first deduction
  let fromPurchased = Math.min(user.purchasedBalance, cost);
  let fromEarned = cost - fromPurchased;

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { creator: true },
  });
  if (!workflow) throw new Error("Workflow not found");

  const creatorEarnings = Math.floor(cost * CREATOR_COMMISSION_RATE);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$transaction([
    // Deduct from user
    prisma.user.update({
      where: { id: userId },
      data: {
        purchasedBalance: { decrement: fromPurchased },
        earnedBalance: { decrement: fromEarned },
      },
    }),
    // Credit creator's earned balance
    prisma.user.update({
      where: { id: workflow.creatorId },
      data: { earnedBalance: { increment: creatorEarnings } },
    }),
    // Update workflow stats
    prisma.workflow.update({
      where: { id: workflowId },
      data: {
        totalUses: { increment: 1 },
        totalEarnings: { increment: creatorEarnings },
      },
    }),
    // User transaction log
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -cost,
        type: "WORKFLOW_USE",
        wallet: fromEarned > 0 ? "both" : "purchased",
        reason: `Used workflow: ${workflow.name}`,
      },
    }),
    // Creator transaction log
    prisma.creditTransaction.create({
      data: {
        userId: workflow.creatorId,
        amount: creatorEarnings,
        type: "CREATOR_EARNING",
        wallet: "earned",
        reason: `Earned from workflow: ${workflow.name}`,
      },
    }),
    // Upsert daily analytics
    prisma.workflowAnalytics.upsert({
      where: { workflowId_date: { workflowId, date: today } },
      update: {
        runs: { increment: 1 },
        revenueNL: { increment: creatorEarnings },
      },
      create: {
        workflowId,
        date: today,
        runs: 1,
        revenueNL: creatorEarnings,
        uniqueUsers: 1,
      },
    }),
  ]);

  return { cost, creatorEarnings, fromPurchased, fromEarned };
}

// ── Add purchased credits (top-ups / subscriptions) ─────────────

export async function addPurchasedCredits(userId: string, amount: number, reason: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { purchasedBalance: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: { userId, amount, type: "PURCHASE", wallet: "purchased", reason },
    }),
  ]);
}

// ── Request payout (earned NL → real money) ─────────────────────

export async function requestPayout(userId: string, amountNL: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (!PAYOUT_ELIGIBLE_TIERS.includes(user.subscription as any)) {
    throw new Error("Upgrade to Pro or Power to withdraw earnings");
  }

  if (!user.stripeConnectOnboarded || !user.stripeConnectId) {
    throw new Error("Connect your Stripe account first");
  }

  if (amountNL < MINIMUM_PAYOUT_NL) {
    throw new Error(`Minimum payout is ${MINIMUM_PAYOUT_NL} NL`);
  }

  if (user.earnedBalance < amountNL) {
    throw new Error("Insufficient earned balance");
  }

  const amountCents = nlToUsdCents(amountNL);

  // Deduct from earned balance and create payout record
  const [_, payout] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { earnedBalance: { decrement: amountNL } },
    }),
    prisma.payout.create({
      data: {
        userId,
        amountNL,
        amountCents,
        status: "PENDING",
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -amountNL,
        type: "PAYOUT",
        wallet: "earned",
        reason: `Payout requested: ${amountNL} NL ($${(amountCents / 100).toFixed(2)})`,
      },
    }),
  ]);

  return payout;
}

// ── Legacy alias for backwards compat ───────────────────────────
export const addCredits = addPurchasedCredits;
