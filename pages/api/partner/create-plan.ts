/**
 * POST /api/partner/create-plan — Crée un plan pour un SaaS dont l'utilisateur est propriétaire.
 * Si Stripe Connect actif et montant > 0, crée Product + Price sur le compte connecté.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const body = (req.body ?? {}) as {
    partnerId?: string;
    name?: string;
    amount?: number;
    interval?: string;
    stripePriceId?: string;
    features?: string[];
    isBestChoice?: boolean;
  };

  const { partnerId, name, amount = 0, interval, stripePriceId, features, isBestChoice } = body;
  if (!partnerId || !name) return res.status(400).json({ error: "partnerId et name requis" });

  const partner = await (
    prisma as unknown as {
      partner: {
        findFirst: (arg: { where: { id: string; userId: string } }) => Promise<{ id: string; name: string; stripeAccountId: string | null } | null>;
      };
    }
  ).partner.findFirst({
    where: { id: partnerId, userId: session.user.id },
  });
  if (!partner) return res.status(403).json({ error: "SaaS inconnu ou non autorisé" });

  const planAmount = Math.max(0, Number(amount) || 0);
  const planInterval = interval === "year" || interval === "month" ? interval : null;
  let finalStripePriceId = stripePriceId?.trim() || null;

  // Créer Stripe Product + Price sur compte Connect si montant > 0
  if (
    stripe &&
    partner.stripeAccountId &&
    planAmount > 0 &&
    planInterval &&
    !finalStripePriceId
  ) {
    try {
      const stripeOpts = { stripeAccount: partner.stripeAccountId };
      const product = await stripe.products.create(
        { name: `${partner.name} - ${name.trim()}`, metadata: { partnerId, planName: name.trim() } },
        stripeOpts
      );
      const price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: planAmount,
          currency: "eur",
          recurring: { interval: planInterval },
        },
        stripeOpts
      );
      finalStripePriceId = price.id;
    } catch (e) {
      console.error("Stripe price creation failed:", e);
    }
  }

  const plan = await prisma.plan.create({
    data: {
      partnerId,
      name: name.trim(),
      amount: planAmount,
      interval: planAmount > 0 ? planInterval : null,
      stripePriceId: finalStripePriceId,
      features: features ?? undefined,
      isBestChoice: !!isBestChoice,
    },
  });

  return res.status(200).json({
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    interval: plan.interval,
    stripePriceId: plan.stripePriceId,
    isBestChoice: plan.isBestChoice,
  });
}
