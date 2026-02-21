import type { NextApiRequest, NextApiResponse } from "next";
import { buffer } from "micro";
import { getStripeClient } from "@/lib/stripe";
import { addCredits } from "@/lib/credits";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import prisma from "@/lib/prisma";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: "Missing signature" });
  }

  const stripe = getStripeClient();

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  // ── Checkout completed (subscriptions & credit purchases) ──────

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;

    if (session.metadata?.type === "subscription") {
      const { tier, userId, monthlyNolinks } = session.metadata;

      if (userId && tier) {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.tier === tier);
        const nlAmount = monthlyNolinks
          ? parseInt(monthlyNolinks)
          : plan?.monthlyNolinks ?? 0;

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscription: tier as any,
            stripeCustomerId: session.customer as string,
          },
        });

        if (nlAmount > 0) {
          await addCredits(userId, nlAmount, `${tier} plan — first month allocation`);
        }
      }
    } else {
      const { packageId, nolinks } = session.metadata || {};
      if (packageId && nolinks) {
        const customerId = session.customer as string;
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (user) {
          await addCredits(user.id, parseInt(nolinks), `Purchased ${packageId}`);
        }
      }
    }
  }

  // ── Subscription renewal (monthly credit allocation) ───────────

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as any;

    if (invoice.billing_reason === "subscription_cycle") {
      const customerId = invoice.customer as string;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.tier === user.subscription);
        if (plan && plan.monthlyNolinks > 0) {
          await addCredits(
            user.id,
            plan.monthlyNolinks,
            `${plan.name} plan — monthly allocation`
          );
        }
      }
    }
  }

  // ── Subscription cancelled ─────────────────────────────────────

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as any;
    const customerId = subscription.customer as string;

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscription: "FREE" },
      });
    }
  }

  // ── Stripe Connect: account updated (auto-detect onboarding) ──

  if (event.type === "account.updated") {
    const account = event.data.object as any;
    const connectId = account.id as string;

    const isOnboarded =
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true;

    if (isOnboarded) {
      const user = await prisma.user.findFirst({
        where: { stripeConnectId: connectId },
      });

      if (user && !user.stripeConnectOnboarded) {
        await prisma.user.update({
          where: { id: user.id },
          data: { stripeConnectOnboarded: true },
        });
      }
    }
  }

  // ── Stripe Connect: transfer reversed (refund payout) ─────────

  if (event.type === "transfer.reversed") {
    const transfer = event.data.object as any;
    const payoutId = transfer.metadata?.payoutId as string | undefined;

    if (payoutId) {
      const payout = await prisma.payout.findUnique({ where: { id: payoutId } });

      if (payout && payout.status !== "FAILED") {
        await prisma.$transaction([
          prisma.payout.update({
            where: { id: payoutId },
            data: {
              status: "FAILED",
              failureReason: "Transfer reversed by Stripe",
            },
          }),
          prisma.user.update({
            where: { id: payout.userId },
            data: { earnedBalance: { increment: payout.amountNL } },
          }),
          prisma.creditTransaction.create({
            data: {
              userId: payout.userId,
              amount: payout.amountNL,
              type: "PAYOUT_REVERSAL",
              wallet: "earned",
              reason: `Payout reversed — ${payout.amountNL} NL refunded`,
            },
          }),
        ]);
      }
    }
  }

  // ── Stripe Connect: payout to bank failed ──────────────────────

  if (event.type === "payout.failed") {
    const stripePayout = event.data.object as any;
    const connectAccountId = event.account as string | undefined;

    if (connectAccountId) {
      const user = await prisma.user.findFirst({
        where: { stripeConnectId: connectAccountId },
      });

      if (user) {
        const recentPayout = await prisma.payout.findFirst({
          where: {
            userId: user.id,
            status: "COMPLETED",
          },
          orderBy: { completedAt: "desc" },
        });

        if (recentPayout) {
          await prisma.$transaction([
            prisma.payout.update({
              where: { id: recentPayout.id },
              data: {
                status: "FAILED",
                failureReason: stripePayout.failure_message || "Bank payout failed",
              },
            }),
            prisma.user.update({
              where: { id: user.id },
              data: { earnedBalance: { increment: recentPayout.amountNL } },
            }),
            prisma.creditTransaction.create({
              data: {
                userId: user.id,
                amount: recentPayout.amountNL,
                type: "PAYOUT_REVERSAL",
                wallet: "earned",
                reason: `Bank payout failed — ${recentPayout.amountNL} NL refunded`,
              },
            }),
          ]);
        }
      }
    }
  }

  return res.json({ received: true });
}
