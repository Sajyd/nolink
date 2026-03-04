import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { createWiseRecipient } from "@/lib/wise";
import { PAYOUT_ELIGIBLE_TIERS } from "@/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  // GET: return current bank details
  if (req.method === "GET") {
    return res.json({
      payoutIban: user.payoutIban ? maskIban(user.payoutIban) : null,
      payoutBankCountry: user.payoutBankCountry,
      payoutAccountHolder: user.payoutAccountHolder,
      payoutCurrency: user.payoutCurrency,
      payoutVerified: user.payoutVerified,
      hasDetails: !!user.payoutIban,
    });
  }

  // POST: save bank details
  if (req.method === "POST") {
    if (!PAYOUT_ELIGIBLE_TIERS.includes(session.user.subscription as any)) {
      return res.status(403).json({ error: "Upgrade to Pro or Enterprise to set up payouts" });
    }

    const { iban, accountHolder, country, currency } = req.body;

    if (!iban || !accountHolder || !country) {
      return res.status(400).json({ error: "IBAN, account holder name, and country are required" });
    }

    const cleanIban = iban.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleanIban)) {
      return res.status(400).json({ error: "Invalid IBAN format" });
    }

    try {
      const recipient = await createWiseRecipient(
        accountHolder,
        cleanIban,
        currency || "EUR"
      );

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          payoutIban: cleanIban,
          payoutAccountHolder: accountHolder,
          payoutBankCountry: country,
          payoutCurrency: currency || "EUR",
          payoutVerified: true,
          wiseRecipientId: String(recipient.id),
        },
      });

      return res.json({
        success: true,
        payoutIban: maskIban(cleanIban),
        payoutAccountHolder: accountHolder,
        payoutBankCountry: country,
        payoutCurrency: currency || "EUR",
        payoutVerified: true,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to verify bank details with payment provider",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function maskIban(iban: string): string {
  if (iban.length <= 8) return iban;
  return iban.slice(0, 4) + " •••• •••• " + iban.slice(-4);
}
