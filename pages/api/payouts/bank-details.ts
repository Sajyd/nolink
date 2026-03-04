import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { createWiseRecipient } from "@/lib/wise";
import { PAYOUT_ELIGIBLE_TIERS } from "@/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[bank-details] ${req.method} request`);

  let session;
  try {
    session = await getServerSession(req, res, authOptions);
  } catch (err) {
    console.error("[bank-details] getServerSession threw:", err);
    return res.status(500).json({ error: "Session error" });
  }

  if (!session) {
    console.warn("[bank-details] No session found");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`[bank-details] User: ${session.user.id}, sub: ${session.user.subscription}`);

  let user;
  try {
    user = await prisma.user.findUnique({ where: { id: session.user.id } });
  } catch (err) {
    console.error("[bank-details] Prisma findUnique threw:", err);
    return res.status(500).json({ error: "Database error" });
  }

  if (!user) {
    console.warn(`[bank-details] User not found in DB: ${session.user.id}`);
    return res.status(404).json({ error: "User not found" });
  }

  // GET: return current bank details
  if (req.method === "GET") {
    console.log(`[bank-details] GET — hasIban: ${!!user.payoutIban}, verified: ${user.payoutVerified}`);
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
      console.warn(`[bank-details] Tier ${session.user.subscription} not eligible for payouts`);
      return res.status(403).json({ error: "Upgrade to Pro or Enterprise to set up payouts" });
    }

    const { iban, accountHolder, country, currency } = req.body;
    console.log(`[bank-details] POST body — iban: ${iban ? "provided" : "missing"}, holder: ${accountHolder ? "provided" : "missing"}, country: ${country}, currency: ${currency}`);

    if (!iban || !accountHolder || !country) {
      return res.status(400).json({ error: "IBAN, account holder name, and country are required" });
    }

    const cleanIban = iban.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleanIban)) {
      console.warn(`[bank-details] Invalid IBAN format: ${cleanIban.slice(0, 4)}***`);
      return res.status(400).json({ error: "Invalid IBAN format" });
    }

    // Check env vars before calling Wise
    if (!process.env.WISE_API_TOKEN) {
      console.error("[bank-details] WISE_API_TOKEN is not set");
      return res.status(500).json({ error: "Payment provider not configured (token)" });
    }
    if (!process.env.WISE_PROFILE_ID) {
      console.error("[bank-details] WISE_PROFILE_ID is not set");
      return res.status(500).json({ error: "Payment provider not configured (profile)" });
    }

    console.log(`[bank-details] Creating Wise recipient — sandbox: ${process.env.WISE_SANDBOX}, profile: ${process.env.WISE_PROFILE_ID}`);

    try {
      const recipient = await createWiseRecipient(
        accountHolder,
        cleanIban,
        currency || "EUR"
      );
      console.log(`[bank-details] Wise recipient created: ${recipient.id}`);

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
      console.log(`[bank-details] User updated with bank details`);

      return res.json({
        success: true,
        payoutIban: maskIban(cleanIban),
        payoutAccountHolder: accountHolder,
        payoutBankCountry: country,
        payoutCurrency: currency || "EUR",
        payoutVerified: true,
      });
    } catch (error) {
      console.error("[bank-details] Error saving bank details:", error);
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
