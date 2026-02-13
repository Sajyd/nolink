/**
 * GET /api/services
 * Retourne la liste des partenaires SaaS avec leurs plans et prix (Prisma).
 * Utilisé par le dashboard et les pages SaaS.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const partners = await prisma.partner.findMany({
    include: {
      plans: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const services = partners.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? "",
    logoUrl: p.logoUrl,
    primaryColor: p.primaryColor,
    url: p.url ?? undefined,
    features: (p.features as string[] | null) ?? [],
    plans: p.plans.map((pl) => ({
      id: pl.id,
      name: pl.name,
      stripePriceId: pl.stripePriceId,
      amount: pl.amount,
      interval: pl.interval,
      features: (pl.features as string[] | null) ?? [],
    })),
  }));

  return res.status(200).json(services);
}
