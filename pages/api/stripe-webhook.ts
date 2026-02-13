import type { NextApiRequest, NextApiResponse } from "next";
import stripe from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

function buffer(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const raw = await buffer(req);
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripe) return res.status(500).end();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig as string, secret);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e instanceof Error ? e.message : "Unknown"}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = (session.metadata?.user_id as string) ?? null;
    if (userId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const item = sub.items.data[0];
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          status: sub.status,
          priceId: item?.price?.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
        update: {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          status: sub.status,
          priceId: item?.price?.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const item = sub.items.data[0];
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status: sub.status,
        priceId: item?.price?.id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });
  }

  return res.status(200).json({ received: true });
}
