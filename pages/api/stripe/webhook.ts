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

  return res.json({ received: true });
}
