/**
 * GET /api/payment/status?payment_intent_id=pi_xxx
 *
 * Après un paiement (ou confirmation 3DS), le frontend poll cette route pour récupérer
 * le token JWT d'accès une fois le webhook payment_intent.succeeded traité côté serveur.
 * Retourne { status: "pending"|"succeeded", token: string|null }.
 * Auth : session NextAuth. Rate limit.
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

  const paymentIntentId = (req.query.payment_intent_id as string)?.trim();
  if (!paymentIntentId) return res.status(400).json({ error: "payment_intent_id requis" });

  const tx = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, userId: session.user.id },
  });
  if (!tx) {
    return res.status(200).json({ status: "pending", token: null });
  }

  const accessToken = await prisma.accessToken.findFirst({
    where: {
      userId: session.user.id,
      partnerId: tx.partnerId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({
    status: "succeeded",
    token: accessToken?.token ?? null,
  });
}
