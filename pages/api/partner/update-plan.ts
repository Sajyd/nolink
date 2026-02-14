/**
 * PATCH /api/partner/update-plan — Met à jour un plan (owner only).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const body = (req.body ?? {}) as {
    planId?: string;
    partnerId?: string;
    name?: string;
    amount?: number;
    interval?: string;
    features?: string[];
    isBestChoice?: boolean;
  };

  const { planId, partnerId } = body;
  if (!planId || !partnerId) return res.status(400).json({ error: "planId et partnerId requis" });

  const partnerApi = prisma as unknown as {
    partner: { findFirst: (arg: { where: { id: string; userId: string } }) => Promise<{ id: string } | null> };
  };
  const planApi = prisma as unknown as {
    plan: {
      findFirst: (arg: { where: { id: string; partnerId: string } }) => Promise<{ id: string } | null>;
      update: (arg: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
  };
  const partner = await partnerApi.partner.findFirst({
    where: { id: partnerId, userId: session.user.id },
  });
  if (!partner) return res.status(403).json({ error: "SaaS inconnu ou non autorisé" });

  const plan = await planApi.plan.findFirst({
    where: { id: planId, partnerId },
  });
  if (!plan) return res.status(404).json({ error: "Plan inconnu" });

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.amount !== undefined) update.amount = Math.max(0, Number(body.amount) || 0);
  if (body.interval !== undefined)
    update.interval = body.interval === "year" || body.interval === "month" ? body.interval : null;
  if (body.features !== undefined) update.features = body.features;
  if (body.isBestChoice !== undefined) update.isBestChoice = !!body.isBestChoice;

  await planApi.plan.update({
    where: { id: planId },
    data: update,
  });

  return res.status(200).json({ ok: true });
}
