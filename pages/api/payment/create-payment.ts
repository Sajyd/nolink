/**
 * POST /api/payment/create-payment
 * Crée un PaymentIntent pour paiement instantané (carte déjà enregistrée ou après SetupIntent).
 * Body: { partnerId, planId, paymentMethodId? }.
 * Si paymentMethodId fourni (après SetupIntent), on l'attache au customer et on charge.
 * Sinon on utilise le stripePaymentMethodId de l'utilisateur (paiement transparent).
 * Split vers le compte Stripe Connect du partenaire via transfer_data.destination.
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
  if (!stripe) return res.status(500).json({ error: "Stripe non configuré" });

  const { partnerId, planId, paymentMethodId } = (req.body ?? {}) as {
    partnerId?: string;
    planId?: string;
    paymentMethodId?: string;
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
          partner: { stripeAccountId: string | null };
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
  if (plan.amount <= 0) {
    return res.status(400).json({ error: "Ce plan est gratuit, utilisez l'accès direct" });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, stripePaymentMethodId: true } as any,
  });

  let customerId: string | null = (user as { stripeCustomerId?: string | null } | null)?.stripeCustomerId ?? null;
  let paymentMethodToUse: string | null = paymentMethodId ?? (user as { stripePaymentMethodId?: string | null } | null)?.stripePaymentMethodId ?? null;

  if (paymentMethodId && !user?.stripePaymentMethodId) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripePaymentMethodId: paymentMethodId } as any,
    });
  }

  if (!customerId || !paymentMethodToUse) {
    return res.status(400).json({
      error: "Aucun mode de paiement enregistré",
      needSetupIntent: true,
    });
  }

  const amount = plan.amount;
  const stripeAccountId = plan.partner.stripeAccountId ?? undefined;

  const paymentIntentParams: {
    amount: number;
    currency: string;
    customer: string;
    payment_method: string;
    confirm: boolean;
    off_session: boolean;
    metadata: { nolink_user_id: string; partner_id: string; plan_id: string };
    automatic_payment_methods?: { enabled: boolean };
    transfer_data?: { destination: string };
  } = {
    amount,
    currency: "eur",
    customer: customerId as string,
    payment_method: paymentMethodToUse as string,
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
