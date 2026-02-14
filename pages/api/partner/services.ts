/**
 * GET /api/partner/services — Liste des SaaS du partenaire connecté (userId = owner).
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

  const partners = await (
    prisma as unknown as {
      partner: {
        findMany: (arg: {
          where: { userId: string };
          include: { plans: true };
          orderBy: { createdAt: "desc" };
        }) => Promise<
          Array<{
            id: string;
            name: string;
            slug: string;
            logoUrl: string | null;
            primaryColor: string | null;
            description: string | null;
            url: string | null;
            callbackUrl: string | null;
            tags: string | null;
            stripeAccountId: string | null;
            plans: Array<{ id: string; name: string; amount: number; interval: string | null; stripePriceId: string | null; features: unknown }>;
          }>
        >;
      };
    }
  ).partner.findMany({
    where: { userId: session.user.id },
    include: { plans: true },
    orderBy: { createdAt: "desc" },
  });

  const services = partners.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    logoUrl: p.logoUrl,
    primaryColor: p.primaryColor,
    description: p.description,
    url: p.url,
    callbackUrl: p.callbackUrl,
    tags: p.tags,
    stripeAccountId: p.stripeAccountId ? "connected" : null,
    plans: p.plans.map((pl) => ({
      id: pl.id,
      name: pl.name,
      amount: pl.amount,
      interval: pl.interval,
      stripePriceId: pl.stripePriceId,
      features: (pl.features as string[] | null) ?? [],
    })),
  }));

  return res.status(200).json(services);
}
