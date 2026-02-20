/**
 * GET /api/payment/has-payment-method
 * Indique si l'utilisateur connecté a déjà un PaymentMethod enregistré (carte).
 * Utilisé par le frontend pour afficher "Paiement instantané avec carte déjà enregistrée"
 * et éviter d'ouvrir le formulaire carte si paiement off_session possible.
 * Sécurisé : session NextAuth requise.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Trop de requêtes." });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripePaymentMethodId: true },
  });

  const hasPaymentMethod = Boolean(
    (user as { stripePaymentMethodId?: string | null } | null)?.stripePaymentMethodId
  );

  return res.status(200).json({ hasPaymentMethod });
}
