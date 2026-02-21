import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Promo code is required" });
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
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

  return res.json({
    valid: true,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    description: describePromo(promo.type, promo.value),
  });
}

function describePromo(type: string, value: number): string {
  switch (type) {
    case "CREDITS":
      return `${value} free Nolinks`;
    case "PERCENT_OFF":
      return `${value}% off your purchase`;
    case "FIXED_OFF":
      return `$${(value / 100).toFixed(2)} off your purchase`;
    default:
      return "Discount applied";
  }
}
