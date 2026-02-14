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

  const { partnerId, planId, return_url } = (req.body ?? {}) as {
    partnerId?: string;
    planId?: string;
    return_url?: string;
  };
  if (!partnerId || !planId) {
    return res.status(400).json({ error: "partnerId et planId requis" });
  }

  const plan = await (
    prisma as unknown as {
      plan: {
        findFirst: (arg: { where: { id: string; partnerId: string }; include: { partner: true } }) => Promise<{
          id: string;
          amount: number;
          stripePriceId: string | null;
          partner: { slug: string; stripeAccountId: string | null };
        } | null>;
      };
    }
  ).plan.findFirst({
    where: { id: planId, partnerId },
    include: { partner: true },
  });
  if (!plan || !plan.partner) {
    return res.status(400).json({ error: "Plan ou partenaire inconnu" });
  }
  const stripeAccount = plan.partner.stripeAccountId ?? undefined;

  const userId = session.user.id;

  if (plan.amount === 0) {
    await prisma.subscription.upsert({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma generated type may omit fields on Vercel
      where: { userId_partnerId: { userId, partnerId } } as any,
      create: {
        userId,
        partnerId,
        planId: plan.id,
        status: "active",
      } as any,
      update: { planId: plan.id, status: "active" } as any,
    });
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    if (return_url && return_url.startsWith("http")) {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "nolink-dev-secret"
      );
      const token = await new SignJWT({ userId, partnerId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(Math.floor(Date.now() / 1000) + 15 * 60)
        .sign(secret);
      const redirect = `${return_url}${return_url.includes("?") ? "&" : "?"}nolink_token=${encodeURIComponent(token)}`;
      return res.status(200).json({ url: redirect, success: true });
    }
    return res.status(200).json({ url: `${baseUrl}/dashboard`, success: true });
  }

  if (!stripe || !plan.stripePriceId) {
    return res.status(500).json({ error: "Paiement non configuré pour ce plan" });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  // Pour Stripe Connect, on ne réutilise pas le customer platform (compte différent)
  const existingSub = stripeAccount
    ? null
    : await prisma.subscription.findFirst({
        where: { userId },
        select: { stripeCustomerId: true },
      });
  const customerId = existingSub?.stripeCustomerId ?? undefined;

  const successPath =
    return_url && return_url.startsWith("http")
      ? `/access/complete?return_url=${encodeURIComponent(return_url)}&slug=${encodeURIComponent(plan.partner.slug)}`
      : "/dashboard?success=1";

  try {
    const sessionParams = {
      mode: "subscription" as const,
      payment_method_types: ["card" as const],
      line_items: [{ price: plan.stripePriceId!, quantity: 1 }],
      success_url: `${baseUrl}${successPath}`,
      cancel_url: `${baseUrl}/s/${plan.partner.slug}`,
      customer: customerId || undefined,
      customer_email: customerId ? undefined : session.user.email,
      metadata: { user_id: userId, partner_id: partnerId, plan_id: plan.id },
      subscription_data: { metadata: { user_id: userId, partner_id: partnerId, plan_id: plan.id } },
    };
    const createOpts = stripeAccount ? { stripeAccount } : {};
    const checkoutSession = await stripe.checkout.sessions.create(sessionParams, createOpts);
    if (checkoutSession.url) {
      return res.status(200).json({ url: checkoutSession.url });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur Stripe" });
  }
  return res.status(500).json({ error: "Erreur Stripe" });
}
