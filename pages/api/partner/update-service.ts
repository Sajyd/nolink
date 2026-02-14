/**
 * PATCH /api/partner/update-service — Met à jour un SaaS (owner only).
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
    partnerId?: string;
    name?: string;
    logoUrl?: string;
    url?: string;
    callbackUrl?: string;
    description?: string;
    primaryColor?: string;
    ctaLabel?: string;
    features?: string[];
    tags?: string;
  };

  const { partnerId, ...data } = body;
  if (!partnerId) return res.status(400).json({ error: "partnerId requis" });

  const partnerApi = prisma as unknown as {
    partner: {
      findFirst: (arg: { where: { id: string; userId: string } }) => Promise<{ id: string } | null>;
      update: (arg: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
  };
  const partner = await partnerApi.partner.findFirst({
    where: { id: partnerId, userId: session.user.id },
  });
  if (!partner) return res.status(403).json({ error: "SaaS inconnu ou non autorisé" });

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl?.trim() || null;
  if (data.url !== undefined) update.url = data.url?.trim() || null;
  if (data.callbackUrl !== undefined) update.callbackUrl = data.callbackUrl?.trim() || null;
  if (data.description !== undefined) update.description = data.description?.trim() || null;
  if (data.primaryColor !== undefined) update.primaryColor = data.primaryColor?.trim() || null;
  if (data.ctaLabel !== undefined) update.ctaLabel = data.ctaLabel?.trim() || null;
  if (data.features !== undefined) update.features = data.features;
  if (data.tags !== undefined) update.tags = data.tags?.trim() || null;

  await partnerApi.partner.update({
    where: { id: partnerId },
    data: update,
  });

  return res.status(200).json({ ok: true });
}
