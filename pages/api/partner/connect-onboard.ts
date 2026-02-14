/**
 * GET /api/partner/connect-onboard?partnerId=xxx — Retourne l'URL Stripe Connect onboarding pour ce partenaire.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import stripe from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const partnerId = req.query.partnerId as string;
  if (!partnerId) return res.status(400).json({ error: "partnerId requis" });

  const partnerApi = prisma as unknown as {
    partner: {
      findFirst: (arg: { where: { id: string; userId: string } }) => Promise<{ id: string; stripeAccountId: string | null } | null>;
      update: (arg: { where: { id: string }; data: { stripeAccountId: string } }) => Promise<unknown>;
    };
  };
  const partner = await partnerApi.partner.findFirst({
    where: { id: partnerId, userId: session.user.id },
  });
  if (!partner) return res.status(403).json({ error: "SaaS inconnu ou non autorisé" });

  if (!stripe) return res.status(500).json({ error: "Stripe non configuré" });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    if (partner.stripeAccountId) {
      const accountLink = await stripe.accountLinks.create({
        account: partner.stripeAccountId,
        refresh_url: `${baseUrl}/partner/${partner.id}?refresh=1`,
        return_url: `${baseUrl}/partner/${partner.id}?connected=1`,
        type: "account_onboarding",
      });
      return res.status(200).json({ url: accountLink.url });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "FR",
    });
    await partnerApi.partner.update({
      where: { id: partner.id },
      data: { stripeAccountId: account.id },
    });
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/partner/${partner.id}?refresh=1`,
      return_url: `${baseUrl}/partner/${partner.id}?connected=1`,
      type: "account_onboarding",
    });
    return res.status(200).json({ url: accountLink.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur Stripe Connect" });
  }
}
