/**
 * POST /api/access
 * Crée un accès au SaaS : vérifie session, limite freemium/pro, incrémente usage, retourne l’URL du partenaire.
 * Body: { serviceId } (id partenaire) ou { slug } (slug partenaire).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const FREE_DAILY_LIMIT = 1;

async function isProForPartner(userId: string, partnerId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, partnerId, status: "active" },
  });
  return !!sub;
}

async function isProLegacy(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "active", partnerId: null },
  });
  return !!sub;
}

async function getTodayUsage(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await prisma.usage.findUnique({
    where: { userId_date: { userId, date: new Date(today) } },
  });
  return row?.count ?? 0;
}

async function incrementUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const date = new Date(today);
  await prisma.usage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ url?: string; error?: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Trop de requêtes. Réessayez plus tard." });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const { serviceId, slug } = (req.body ?? {}) as { serviceId?: string; slug?: string };
  const partner = await prisma.partner.findFirst({
    where: serviceId ? { id: serviceId } : slug ? { slug } : undefined,
  });
  if (!partner?.url) return res.status(400).json({ error: "Service inconnu" });

  const userId = session.user.id;
  const pro = await isProForPartner(userId, partner.id) || await isProLegacy(userId);
  if (!pro) {
    const used = await getTodayUsage(userId);
    if (used >= FREE_DAILY_LIMIT) {
      return res.status(402).json({
        error:
          "Limite freemium atteinte (1 test/jour). Passez Pro pour un accès illimité.",
      });
    }
  }

  await incrementUsage(userId);
  return res.status(200).json({ url: partner.url });
}
