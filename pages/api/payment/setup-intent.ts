/**
 * POST /api/payment/setup-intent
 * Crée un SetupIntent pour enregistrer une carte (première fois). Retourne client_secret pour Stripe Elements.
 * PCI compliant : la carte n'est jamais envoyée à notre serveur.
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
  if (!session?.user?.id || !session?.user?.email) {
    return res.status(401).json({ error: "Non connecté" });
  }
  if (!stripe) return res.status(500).json({ error: "Stripe non configuré" });

  const userId = session.user.id;
  try {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true } as any,
    });
    let customerId: string | null = (user as { stripeCustomerId?: string | null } | null)?.stripeCustomerId ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        metadata: { nolink_user_id: userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId } as any,
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { nolink_user_id: userId },
    });

    return res.status(200).json({ client_secret: setupIntent.client_secret });
  } catch (e) {
    console.error("SetupIntent error:", e);
    return res.status(500).json({ error: "Erreur lors de la création du mode de paiement" });
  }
}
