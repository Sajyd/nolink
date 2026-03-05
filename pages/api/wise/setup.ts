import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { createWiseRecipient } from "@/lib/wise";
import { PAYOUT_ELIGIBLE_TIERS } from "@/lib/constants";

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!PAYOUT_ELIGIBLE_TIERS.includes(session.user.subscription as any)) {
    return res.status(403).json({ error: "Upgrade to Pro or Enterprise to set up Wise payouts" });
  }

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { iban: true, ibanAccountHolder: true, wiseRecipientId: true, payoutMethod: true },
    });
    return res.json({
      iban: user?.iban ?? null,
      ibanAccountHolder: user?.ibanAccountHolder ?? null,
      wiseReady: !!(user?.iban && user?.ibanAccountHolder && user?.wiseRecipientId),
      payoutMethod: user?.payoutMethod ?? null,
    });
  }

  if (req.method === "POST") {
    const { iban, accountHolder } = req.body;

    if (!iban || typeof iban !== "string") {
      return res.status(400).json({ error: "IBAN is required" });
    }
    if (!accountHolder || typeof accountHolder !== "string") {
      return res.status(400).json({ error: "Account holder name is required" });
    }

    const cleanIban = iban.replace(/\s/g, "").toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      return res.status(400).json({ error: "Invalid IBAN format" });
    }

    try {
      const recipient = await createWiseRecipient(accountHolder.trim(), cleanIban);

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          iban: cleanIban,
          ibanAccountHolder: accountHolder.trim(),
          wiseRecipientId: recipient.id,
          payoutMethod: "WISE",
        },
      });

      return res.json({
        success: true,
        iban: cleanIban,
        ibanAccountHolder: accountHolder.trim(),
        wiseReady: true,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to set up Wise recipient",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
