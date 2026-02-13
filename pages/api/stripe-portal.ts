/**
 * POST /api/stripe-portal
 * Crée une session Stripe Customer Portal (gestion moyens de paiement, factures) et redirige l’utilisateur.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  if (!stripe) return res.status(500).json({ error: "Stripe non configuré" });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const returnUrl = `${baseUrl}/dashboard`;

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });

  const customerId = subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    return res.status(400).json({
      error: "Aucun moyen de paiement enregistré. Souscrivez à un plan Pro pour accéder au portail.",
    });
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    if (portalSession.url) return res.status(200).json({ url: portalSession.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur Stripe" });
  }
  return res.status(500).json({ error: "Erreur Stripe" });
}
