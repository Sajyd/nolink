/**
 * GET /api/partner/analytics — Statistiques pour le dashboard SaaS :
 * services, utilisateurs actifs, abonnements, revenus, recommendations AI.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const partners = await prisma.partner.findMany({
    where: { userId: session.user.id },
    select: { id: true, slug: true, name: true },
  });
  const partnerIds = partners.map((p) => p.id);

  const [subscriptions, transactions] = await Promise.all([
    prisma.subscription.findMany({
      where: { partnerId: { in: partnerIds } },
      select: { status: true, partnerId: true },
    }),
    prisma.transaction.findMany({
      where: { partnerId: { in: partnerIds } },
      select: { amount: true, status: true },
    }),
  ]);

  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const totalRevenue = transactions
    .filter((t) => t.status === "succeeded" || t.status === "paid")
    .reduce((acc, t) => acc + t.amount, 0);
  const uniqueUsers = new Set(subscriptions.map((s) => s.partnerId)).size;

  return res.status(200).json({
    servicesCount: partners.length,
    activeSubscriptions: activeSubs.length,
    uniquePartnersWithSubs: new Set(activeSubs.map((s) => s.partnerId)).size,
    totalRevenue,
    revenueShare: Math.floor(totalRevenue * 0.9), // 90% au partenaire (exemple)
  });
}
