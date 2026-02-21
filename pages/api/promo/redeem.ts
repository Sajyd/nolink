import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { addCredits } from "@/lib/credits";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Promo code is required" });
  }

  const normalizedCode = code.trim().toUpperCase();

  const promo = await prisma.promoCode.findUnique({
    where: { code: normalizedCode },
  });

  if (!promo || !promo.active) {
    return res.status(404).json({ error: "Invalid promo code" });
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return res.status(410).json({ error: "This promo code has expired" });
  }

  if (promo.maxUses !== null && promo.timesUsed >= promo.maxUses) {
    return res.status(410).json({ error: "This promo code has been fully redeemed" });
  }

  const userRedemptions = await prisma.promoCodeRedemption.count({
    where: { promoCodeId: promo.id, userId: session.user.id },
  });

  if (userRedemptions >= promo.perUserLimit) {
    return res.status(409).json({ error: "You have already used this promo code" });
  }

  if (promo.type !== "CREDITS") {
    return res.status(400).json({
      error: "This promo code can only be applied during checkout",
      type: promo.type,
    });
  }

  await prisma.$transaction([
    prisma.promoCode.update({
      where: { id: promo.id },
      data: { timesUsed: { increment: 1 } },
    }),
    prisma.promoCodeRedemption.create({
      data: {
        promoCodeId: promo.id,
        userId: session.user.id,
        appliedTo: "direct",
        discount: promo.value,
      },
    }),
  ]);

  await addCredits(session.user.id, promo.value, `Promo code: ${promo.code}`);

  return res.json({
    success: true,
    creditsAdded: promo.value,
    message: `${promo.value} Nolinks added to your balance!`,
  });
}
