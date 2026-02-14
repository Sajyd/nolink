/**
 * GET /api/access/verify?token=xxx
 * Vérifie un JWT d'accès et retourne userId, partnerId, subscription_status (pour le SaaS).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { setCorsHeaders } from "@/lib/cors";

async function verifyAccessToken(token: string): Promise<{ userId: string; partnerId: string } | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "nolink-dev-secret"
    );
    const { payload } = await jwtVerify(token, secret);
    if (!payload.userId || !payload.partnerId) return null;
    return { userId: String(payload.userId), partnerId: String(payload.partnerId) };
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });

  const token = (req.query.token as string)?.trim();
  if (!token) return res.status(400).json({ error: "token required" });

  const payload = await verifyAccessToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired token" });

  const subs = await prisma.subscription.findMany({
    where: { userId: payload.userId, status: "active" },
  });
  const subscription_status = subs.some((s) => s.partnerId === payload.partnerId) ? "active" : "freemium";

  return res.status(200).json({
    user_id: payload.userId,
    partner_id: payload.partnerId,
    subscription_status,
  });
}
