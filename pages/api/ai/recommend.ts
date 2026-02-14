/**
 * GET /api/ai/recommend?slug=xxx — Recommande des SaaS similaires (pour le dashboard user).
 * Accepte ?token=xxx (JWT) pour les appels du SDK partenaire.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { jwtVerify } from "jose";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { recommendSimilar } from "@/lib/ai";
import { setCorsHeaders } from "@/lib/cors";

async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "nolink-dev-secret"
    );
    const { payload } = await jwtVerify(token, secret);
    return payload.userId ? String(payload.userId) : null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });

  const tokenParam = (req.query.token as string)?.trim();
  let userId: string | null = null;
  if (tokenParam) {
    userId = await getUserIdFromToken(tokenParam);
  } else {
    const session = await getServerSession(req, res, authOptions);
    userId = session?.user?.id ?? null;
  }
  if (!userId) return res.status(401).json({ error: "Non connecté" });

  const slug = (req.query.slug as string)?.trim();
  if (!slug) return res.status(400).json({ error: "slug requis" });

  const partners = await (
    prisma as unknown as {
      partner: {
        findMany: (arg: { include: { plans: true } }) => Promise<
          Array<{
            id: string;
            name: string;
            slug: string;
            description: string | null;
            logoUrl: string | null;
            primaryColor: string | null;
            url: string | null;
            plans: Array<{ id: string; name: string; amount: number; interval: string | null; features: unknown }>;
          }>
        >;
      };
    }
  ).partner.findMany({
    include: { plans: true },
  });
  const slugs = await recommendSimilar(slug, partners);
  const recommended = partners
    .filter((p) => slugs.includes(p.slug))
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      logoUrl: p.logoUrl,
      primaryColor: p.primaryColor,
      url: p.url ?? undefined,
      plans: p.plans.map((pl) => ({
        id: pl.id,
        name: pl.name,
        amount: pl.amount,
        interval: pl.interval,
        features: (pl.features as string[] | null) ?? [],
      })),
    }));
  return res.status(200).json(recommended);
}
