/**
 * POST /api/partner/create-service — Crée un SaaS partenaire (nom, slug, logo, url, callback, description, couleurs).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const body = (req.body ?? {}) as {
    name?: string;
    slug?: string;
    logoUrl?: string;
    url?: string;
    callbackUrl?: string;
    description?: string;
    primaryColor?: string;
    ctaLabel?: string;
    features?: string[];
    tags?: string;
  };

  const name = (body.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "name requis" });

  const slug = (body.slug ?? slugify(name)).trim() || slugify(name);
  const existing = await prisma.partner.findUnique({ where: { slug } });
  if (existing) return res.status(400).json({ error: "Ce slug est déjà pris" });

  const partner = await prisma.partner.create({
    data: {
      name,
      slug,
      userId: session.user.id,
      logoUrl: body.logoUrl?.trim() || null,
      url: body.url?.trim() || null,
      callbackUrl: body.callbackUrl?.trim() || null,
      description: body.description?.trim() || null,
      primaryColor: body.primaryColor?.trim() || null,
      ctaLabel: body.ctaLabel?.trim() || null,
      features: body.features ?? undefined,
      tags: body.tags?.trim() || null,
    },
  });

  return res.status(200).json({
    id: partner.id,
    name: partner.name,
    slug: partner.slug,
    url: partner.url,
    callbackUrl: partner.callbackUrl,
  });
}
