/**
 * POST /api/webhook
 * Webhook Stripe sécurisé (signature) : checkout.session.completed, customer.subscription.updated/deleted, invoice.paid.
 * Met à jour Subscription (par user + partner) et crée Transaction sur invoice.paid.
 */

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
    const partnerIdRaw = session.metadata?.partner_id as string | undefined;
    const partnerId = partnerIdRaw || null;
    const planId = (session.metadata?.plan_id as string) || null;
    if (userId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const item = sub.items.data[0];
      const data = {
        planId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: sub.id,
        status: sub.status,
        priceId: item?.price?.id ?? undefined,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      };
      if (partnerId) {
        await prisma.subscription.upsert({
          where: { userId_partnerId: { userId, partnerId } },
          create: { userId, partnerId, ...data },
          update: data,
        });
      } else {
        const subs = await prisma.subscription.findMany({
          where: { userId },
        });
        const existing = subs.find((s) => s.partnerId === null);
        if (existing) {
          await prisma.subscription.update({ where: { id: existing.id }, data });
        } else {
          await prisma.subscription.create({
            data: { userId, partnerId: null, ...data },
          });
        }
      }
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
        priceId: item?.price?.id ?? undefined,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string | null;
    if (subscriptionId && invoice.customer) {
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });
      if (sub?.partnerId) {
        await prisma.transaction.create({
          data: {
            userId: sub.userId,
            partnerId: sub.partnerId,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid ?? 0,
            status: "paid",
          },
        });
      }
    }
  }

  return res.status(200).json({ received: true });
}
