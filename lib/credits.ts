import prisma from "./prisma";
import {
  NL_TO_USD_CENTS,
  MINIMUM_PAYOUT_NL,
  PAYOUT_ELIGIBLE_TIERS,
  PLATFORM_FEE_PERCENT,
  PAYOUT_HOLDING_DAYS,
} from "./constants";

// ── Balance helpers ─────────────────────────────────────────────

export function totalBalance(bonus: number, purchased: number, earned: number) {
  return bonus + purchased + earned;
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
    select: { bonusBalance: true, purchasedBalance: true, earnedBalance: true },
  });
  if (!user) return false;
  return totalBalance(user.bonusBalance, user.purchasedBalance, user.earnedBalance) >= cost;
}

// ── Deduct credits (bonus-first, then purchased, then earned) ───

export async function deductCredits(
  userId: string,
  workflowId: string,
  cost: number,
  baseCost: number = 0
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || totalBalance(user.bonusBalance, user.purchasedBalance, user.earnedBalance) < cost) {
    throw new Error("Insufficient Nolinks balance");
  }

  // 3-wallet deduction: bonus first (free NL), then purchased (real money), then earned
  let remaining = cost;
  const fromBonus = Math.min(user.bonusBalance, remaining);
  remaining -= fromBonus;
  const fromPurchased = Math.min(user.purchasedBalance, remaining);
  remaining -= fromPurchased;
  const fromEarned = remaining;

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { creator: true },
  });
  if (!workflow) throw new Error("Workflow not found");

  // Creator earnings are proportional to the revenue-backed portion only.
  // Bonus NL are platform-subsidized and generate zero creator earnings.
  const paidPortion = fromPurchased + fromEarned;
  const paidRatio = cost > 0 ? paidPortion / cost : 0;
  const rawCreatorEarnings = Math.max(0, cost - baseCost);
  const creatorEarnings = Math.floor(
    rawCreatorEarnings * paidRatio * (1 - PLATFORM_FEE_PERCENT / 100)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const walletLabel =
    [fromBonus > 0 && "bonus", fromPurchased > 0 && "purchased", fromEarned > 0 && "earned"]
      .filter(Boolean)
      .join("+");

  const ops = [
    // Deduct from user's wallets
    prisma.user.update({
      where: { id: userId },
      data: {
        bonusBalance: { decrement: fromBonus },
        purchasedBalance: { decrement: fromPurchased },
        earnedBalance: { decrement: fromEarned },
      },
    }),
    // Credit creator's earned balance (only revenue-backed portion minus platform fee)
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
        wallet: walletLabel,
        reason: `Used workflow: ${workflow.name}`,
      },
    }),
    // Creator transaction log (only if they earned something)
    ...(creatorEarnings > 0
      ? [
          prisma.creditTransaction.create({
            data: {
              userId: workflow.creatorId,
              amount: creatorEarnings,
              type: "CREATOR_EARNING",
              wallet: "earned",
              reason: `Earned from workflow: ${workflow.name}`,
            },
          }),
        ]
      : []),
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
  ];

  await prisma.$transaction(ops);

  return { cost, creatorEarnings, fromBonus, fromPurchased, fromEarned };
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

// ── Add bonus credits (signup, promotions) ──────────────────────

export async function addBonusCredits(userId: string, amount: number, reason: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { bonusBalance: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: { userId, amount, type: "BONUS", wallet: "bonus", reason },
    }),
  ]);
}

// ── Request payout (earned NL → real money) ─────────────────────

export async function requestPayout(userId: string, amountNL: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (!PAYOUT_ELIGIBLE_TIERS.includes(user.subscription as any)) {
    throw new Error("Upgrade to Pro or Enterprise to withdraw earnings");
  }

  if (!user.stripeConnectOnboarded || !user.stripeConnectId) {
    throw new Error("Connect your Stripe account before requesting a payout");
  }

  if (amountNL < MINIMUM_PAYOUT_NL) {
    throw new Error(`Minimum payout is ${MINIMUM_PAYOUT_NL} NL (${nlToUsdString(MINIMUM_PAYOUT_NL)})`);
  }

  if (user.earnedBalance < amountNL) {
    throw new Error("Insufficient earned balance");
  }

  // Holding period: user must have been earning for at least PAYOUT_HOLDING_DAYS
  const firstEarning = await prisma.creditTransaction.findFirst({
    where: { userId, type: "CREATOR_EARNING" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (firstEarning) {
    const eligibleDate = new Date(firstEarning.createdAt);
    eligibleDate.setDate(eligibleDate.getDate() + PAYOUT_HOLDING_DAYS);
    if (new Date() < eligibleDate) {
      const daysLeft = Math.ceil((eligibleDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      throw new Error(
        `Payouts are available ${PAYOUT_HOLDING_DAYS} days after your first earning. ${daysLeft} day(s) remaining.`
      );
    }
  } else {
    throw new Error("No earnings to withdraw");
  }

  const amountCents = nlToUsdCents(amountNL);

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
