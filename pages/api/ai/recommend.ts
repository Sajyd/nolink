/**
 * GET /api/ai/recommend?slug=xxx — Recommande des SaaS similaires (pour le dashboard user).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { recommendSimilar } from "@/lib/ai";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const slug = (req.query.slug as string)?.trim();
  if (!slug) return res.status(400).json({ error: "slug requis" });

  const partners = await prisma.partner.findMany({
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
