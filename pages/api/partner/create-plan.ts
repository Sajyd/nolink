/**
 * POST /api/partner/create-plan — Crée un plan pour un SaaS dont l'utilisateur est propriétaire.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
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
  };

  const { partnerId, name, amount = 0, interval, stripePriceId, features } = body;
  if (!partnerId || !name) return res.status(400).json({ error: "partnerId et name requis" });

  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, userId: session.user.id },
  });
  if (!partner) return res.status(403).json({ error: "SaaS inconnu ou non autorisé" });

  const plan = await prisma.plan.create({
    data: {
      partnerId,
      name: name.trim(),
      amount: Math.max(0, Number(amount) || 0),
      interval: interval === "year" || interval === "month" ? interval : null,
      stripePriceId: stripePriceId?.trim() || null,
      features: features ?? undefined,
    },
  });

  return res.status(200).json({
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    interval: plan.interval,
    stripePriceId: plan.stripePriceId,
  });
}
