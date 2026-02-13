/**
 * POST /api/create-subscription
 * Crée un abonnement pour un partenaire : plan Freemium (gratuit) en DB, plan Pro via Stripe Checkout (platform).
 * Body: { partnerId, planId }. Metadata Stripe : user_id, partner_id, plan_id pour le webhook.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Trop de requêtes. Réessayez plus tard." });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return res.status(401).json({ error: "Non connecté" });
  }

  const { partnerId, planId } = (req.body ?? {}) as { partnerId?: string; planId?: string };
  if (!partnerId || !planId) {
    return res.status(400).json({ error: "partnerId et planId requis" });
  }

  const plan = await prisma.plan.findFirst({
    where: { id: planId, partnerId },
    include: { partner: true },
  });
  if (!plan || !plan.partner) {
    return res.status(400).json({ error: "Plan ou partenaire inconnu" });
  }

  const userId = session.user.id;

  if (plan.amount === 0) {
    await prisma.subscription.upsert({
      where: { userId_partnerId: { userId, partnerId } },
      create: {
        userId,
        partnerId,
        planId: plan.id,
        status: "active",
      },
      update: { planId: plan.id, status: "active" },
    });
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    return res.status(200).json({ url: `${baseUrl}/dashboard`, success: true });
  }

  if (!stripe || !plan.stripePriceId) {
    return res.status(500).json({ error: "Paiement non configuré pour ce plan" });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const existingSub = await prisma.subscription.findFirst({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  const customerId = existingSub?.stripeCustomerId ?? undefined;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?success=1`,
      cancel_url: `${baseUrl}/s/${plan.partner.slug}`,
      customer: customerId || undefined,
      customer_email: customerId ? undefined : session.user.email,
      metadata: {
        user_id: userId,
        partner_id: partnerId,
        plan_id: plan.id,
      },
      subscription_data: {
        metadata: { user_id: userId, partner_id: partnerId, plan_id: plan.id },
      },
    });
    if (checkoutSession.url) {
      return res.status(200).json({ url: checkoutSession.url });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur Stripe" });
  }
  return res.status(500).json({ error: "Erreur Stripe" });
}
