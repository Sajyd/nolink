/**
 * POST /api/payment/confirm
 * Webhook Stripe pour : setup_intent.succeeded (sauvegarde PaymentMethod) et payment_intent.succeeded (création abo + token).
 * Configurer dans Stripe : Webhook endpoint URL = https://votredomaine.com/api/payment/confirm
 * Signature vérifiée avec STRIPE_WEBHOOK_SECRET_PAYMENT (ou STRIPE_WEBHOOK_SECRET si un seul webhook).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import stripe from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { signAccessToken } from "@/lib/auth";
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
  const secret =
    process.env.STRIPE_WEBHOOK_SECRET_PAYMENT || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripe) return res.status(500).end();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig as string, secret);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e instanceof Error ? e.message : "Unknown"}`);
  }

  if (event.type === "setup_intent.succeeded") {
    const setupIntent = event.data.object as Stripe.SetupIntent;
    const userId = setupIntent.metadata?.nolink_user_id;
    const paymentMethodId = setupIntent.payment_method;
    if (userId && paymentMethodId) {
      await prisma.user.update({
        where: { id: userId },
        data: { stripePaymentMethodId: String(paymentMethodId) },
      });
    }
    return res.status(200).json({ received: true });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const userId = paymentIntent.metadata?.nolink_user_id;
    const partnerId = paymentIntent.metadata?.partner_id;
    const planId = paymentIntent.metadata?.plan_id;
    if (!userId || !partnerId || !planId) {
      return res.status(200).json({ received: true });
    }

    await prisma.transaction.create({
      data: {
        userId,
        partnerId,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        status: "succeeded",
      },
    });

    await prisma.subscription.upsert({
      where: { userId_partnerId: { userId, partnerId } },
      create: {
        userId,
        partnerId,
        planId,
        status: "active",
      },
      update: { planId, status: "active" },
    });

    const token = await signAccessToken(userId, partnerId);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.accessToken.create({
      data: {
        userId,
        partnerId,
        token,
        expiresAt,
      },
    });

    return res.status(200).json({ received: true });
  }

  return res.status(200).json({ received: true });
}
