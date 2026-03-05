import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { createWiseRecipient } from "@/lib/wise";
import { PAYOUT_ELIGIBLE_TIERS } from "@/lib/constants";

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[wise/setup] ${req.method} request`);

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    console.warn("[wise/setup] No session");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`[wise/setup] User: ${session.user.id}, sub: ${session.user.subscription}`);

  if (!PAYOUT_ELIGIBLE_TIERS.includes(session.user.subscription as any)) {
    console.warn(`[wise/setup] Tier ${session.user.subscription} not eligible`);
    return res.status(403).json({ error: "Upgrade to Pro or Enterprise to set up Wise payouts" });
  }

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { iban: true, ibanAccountHolder: true, wiseRecipientId: true, payoutMethod: true },
    });
    console.log(`[wise/setup] GET — hasIban: ${!!user?.iban}, recipientId: ${user?.wiseRecipientId}, method: ${user?.payoutMethod}`);
    return res.json({
      iban: user?.iban ?? null,
      ibanAccountHolder: user?.ibanAccountHolder ?? null,
      wiseReady: !!(user?.iban && user?.ibanAccountHolder && user?.wiseRecipientId),
      payoutMethod: user?.payoutMethod ?? null,
    });
  }

  if (req.method === "POST") {
    const { iban, accountHolder } = req.body;
    console.log(`[wise/setup] POST — iban: ${iban ? iban.slice(0, 4) + "***" : "missing"}, holder: ${accountHolder ? "provided" : "missing"}`);

    if (!iban || typeof iban !== "string") {
      return res.status(400).json({ error: "IBAN is required" });
    }
    if (!accountHolder || typeof accountHolder !== "string") {
      return res.status(400).json({ error: "Account holder name is required" });
    }

    const cleanIban = iban.replace(/\s/g, "").toUpperCase();
    if (!IBAN_REGEX.test(cleanIban)) {
      console.warn(`[wise/setup] Invalid IBAN format: ${cleanIban.slice(0, 4)}***`);
      return res.status(400).json({ error: "Invalid IBAN format" });
    }

    if (!process.env.WISE_API_TOKEN) {
      console.error("[wise/setup] WISE_API_TOKEN is not set");
      return res.status(500).json({ error: "Payment provider not configured (token)" });
    }
    if (!process.env.WISE_PROFILE_ID) {
      console.error("[wise/setup] WISE_PROFILE_ID is not set");
      return res.status(500).json({ error: "Payment provider not configured (profile)" });
    }

    console.log(`[wise/setup] Calling Wise API — sandbox: ${process.env.WISE_SANDBOX}, profile: ${process.env.WISE_PROFILE_ID}`);

    try {
      const recipient = await createWiseRecipient(accountHolder.trim(), cleanIban);
      console.log(`[wise/setup] Wise recipient created: ${recipient.id}`);

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          iban: cleanIban,
          ibanAccountHolder: accountHolder.trim(),
          wiseRecipientId: recipient.id,
          payoutMethod: "WISE",
        },
      });
      console.log(`[wise/setup] User updated`);

      return res.json({
        success: true,
        iban: cleanIban,
        ibanAccountHolder: accountHolder.trim(),
        wiseReady: true,
      });
    } catch (error) {
      console.error("[wise/setup] Error:", error);
      return res.status(500).json({
        error: "Failed to set up Wise recipient",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
