/**
 * POST /api/access
 * Vérifie abonnement → génère JWT → optionnel callback POST vers SaaS → retourne url avec token.
 * Body: { serviceId } ou { slug }. Si pas abonné: 402 + needSubscription + slug pour rediriger vers /s/[slug].
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { SignJWT } from "jose";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const FREE_DAILY_LIMIT = 1;
const JWT_EXPIRY_SEC = 15 * 60; // 15 min

async function signAccessToken(userId: string, partnerId: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "nolink-dev-secret"
  );
  return new SignJWT({ userId, partnerId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_EXPIRY_SEC)
    .sign(secret);
}

async function isProForPartner(userId: string, partnerId: string): Promise<boolean> {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "active" },
    select: { partnerId: true },
  });
  return subs.some((s) => s.partnerId === partnerId);
}

async function isProLegacy(userId: string): Promise<boolean> {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: "active" },
    select: { partnerId: true },
  });
  return subs.some((s) => s.partnerId === null);
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

/** POST vers callback URL du partenaire avec user_id, subscription_status, token (JWT) */
async function notifyCallback(
  callbackUrl: string,
  payload: { user_id: string; subscription_status: string; token: string }
): Promise<void> {
  try {
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Callback SaaS failed:", e);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    url?: string;
    error?: string;
    needSubscription?: boolean;
    slug?: string;
  }>
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req))
    return res.status(429).json({ error: "Trop de requêtes. Réessayez plus tard." });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const { serviceId, slug } = (req.body ?? {}) as { serviceId?: string; slug?: string };
  const partner = await prisma.partner.findFirst({
    where: serviceId ? { id: serviceId } : slug ? { slug } : undefined,
  });
  if (!partner?.url)
    return res.status(400).json({ error: "Service inconnu" });

  const userId = session.user.id;
  const pro =
    (await isProForPartner(userId, partner.id)) || (await isProLegacy(userId));
  if (!pro) {
    const used = await getTodayUsage(userId);
    if (used >= FREE_DAILY_LIMIT) {
      return res.status(402).json({
        error:
          "Limite freemium atteinte (1 test/jour). Passez Pro pour un accès illimité.",
        needSubscription: true,
        slug: partner.slug,
      });
    }
  }

  await incrementUsage(userId);
  const token = await signAccessToken(userId, partner.id);
  const redirectUrl = `${partner.url}${partner.url.includes("?") ? "&" : "?"}nolink_token=${encodeURIComponent(token)}`;

  if (partner.callbackUrl) {
    await notifyCallback(partner.callbackUrl, {
      user_id: userId,
      subscription_status: pro ? "active" : "freemium",
      token,
    });
  }

  return res.status(200).json({ url: redirectUrl });
}
