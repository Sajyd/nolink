/**
 * POST /api/payment/create-payment
 *
 * Crée un PaymentIntent off_session pour paiement instantané (carte déjà enregistrée
 * ou paymentMethodId venant d'un SetupIntent fraîchement confirmé).
 * Body: { partnerId, planId, paymentMethodId? }.
 * - Si paymentMethodId fourni (après confirmSetup côté client) : on le persiste sur le user puis on charge.
 * - Sinon : on utilise stripePaymentMethodId de l'utilisateur (paiement en 1 clic).
 * Revenue split : transfer_data.destination = Stripe Connect Account ID du partenaire (Partner.stripeAccountId).
 * SCA/3DS : si status requires_action, le client doit confirmer avec client_secret (PaymentModal).
 * Auth : session NextAuth. Rate limit.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Trop de requêtes." });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return res.status(500).json({ error: "Stripe non configuré" });
  }

  const { partnerId, planId, paymentMethodId } = (req.body ?? {}) as {
    partnerId?: string;
    planId?: string;
    paymentMethodId?: string;
  };
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
  if (plan.amount <= 0) {
    return res.status(400).json({ error: "Ce plan est gratuit, utilisez l'accès direct" });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, stripePaymentMethodId: true },
  });

  let customerId: string | null =
    (user as { stripeCustomerId?: string | null } | null)?.stripeCustomerId ?? null;
  let paymentMethodToUse: string | null =
    paymentMethodId ??
    (user as { stripePaymentMethodId?: string | null } | null)?.stripePaymentMethodId ??
    null;

  if (paymentMethodId && !(user as { stripePaymentMethodId?: string | null })?.stripePaymentMethodId) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripePaymentMethodId: paymentMethodId },
    });
  }

  if (!customerId || !paymentMethodToUse) {
    return res.status(400).json({
      error: "Aucun mode de paiement enregistré",
      needSetupIntent: true,
    });
  }

  const amount = plan.amount;
  const stripeAccountId = (plan.partner as { stripeAccountId: string | null }).stripeAccountId ?? undefined;

  const paymentIntentParams: {
    amount: number;
    currency: string;
    customer: string;
    payment_method: string;
    confirm: boolean;
    off_session: boolean;
    metadata: { nolink_user_id: string; partner_id: string; plan_id: string };
    transfer_data?: { destination: string };
  } = {
    amount,
    currency: "eur",
    customer: customerId,
    payment_method: paymentMethodToUse,
    confirm: true,
    off_session: true,
    metadata: { nolink_user_id: userId, partner_id: partnerId, plan_id: plan.id },
  };

  if (stripeAccountId) {
    paymentIntentParams.transfer_data = { destination: stripeAccountId };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    if (paymentIntent.status === "succeeded") {
      return res.status(200).json({
        status: "succeeded",
        payment_intent_id: paymentIntent.id,
        message: "Paiement réussi",
      });
    }
    if (paymentIntent.status === "requires_action") {
      return res.status(200).json({
        status: "requires_action",
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      });
    }

    return res.status(200).json({
      status: paymentIntent.status,
      payment_intent_id: paymentIntent.id,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; type?: string };
    if (err.code === "authentication_required" || err.type === "StripeCardError") {
      return res.status(400).json({
        error: "Authentification requise (3DS) ou carte refusée",
        code: err.code,
      });
    }
    console.error("Create payment error:", e);
    return res.status(500).json({ error: "Erreur lors du paiement" });
  }
}
