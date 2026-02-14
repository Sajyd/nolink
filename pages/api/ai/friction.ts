/**
 * GET /api/ai/friction?partnerId=xxx — Analyse conversion/abandon et retourne suggestions (partenaire).
 * Stats simulées en MVP (views = subs count * 10, checkouts = subs, etc.). En prod : events réels.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { analyzeFriction } from "@/lib/ai";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const partnerId = req.query.partnerId as string;
  if (!partnerId) return res.status(400).json({ error: "partnerId requis" });

  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, userId: session.user.id },
  });
  if (!partner) return res.status(403).json({ error: "SaaS inconnu ou non autorisé" });

  const allSubs = await prisma.subscription.findMany({
    where: { status: "active" },
    select: { partnerId: true },
  });
  const subscriptions = allSubs.filter((s) => s.partnerId === partnerId).length;
  const transactions = await prisma.transaction.count({
    where: { partnerId },
  });
  // MVP: estimation. En prod : table events (page_view, checkout_started, checkout_completed).
  const views = Math.max(subscriptions * 15, 50);
  const checkoutsStarted = Math.max(transactions + subscriptions, Math.floor(views * 0.3));
  const checkoutsCompleted = subscriptions + transactions;

  const suggestions = await analyzeFriction({
    views,
    checkoutsStarted,
    checkoutsCompleted,
    serviceName: partner.name,
  });

  return res.status(200).json({
    views,
    checkoutsStarted,
    checkoutsCompleted,
    conversionRate: views ? ((checkoutsCompleted / views) * 100).toFixed(1) : 0,
    abandonRate: checkoutsStarted
      ? ((1 - checkoutsCompleted / checkoutsStarted) * 100).toFixed(1)
      : 0,
    suggestions,
  });
}
