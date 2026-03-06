import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { requestPayout } from "@/lib/credits";
import { executeStripePayout, checkConnectStatus } from "@/lib/stripe";
import { executeWisePayout } from "@/lib/wise";
import prisma from "@/lib/prisma";
import { PAYOUT_ELIGIBLE_TIERS, NL_TO_USD_CENTS, NL_TO_EUR_CENTS } from "@/lib/constants";
import { sendPayoutEmail } from "@/lib/email";
import type { PayoutMethod } from "@prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!PAYOUT_ELIGIBLE_TIERS.includes(session.user.subscription as any)) {
    return res.status(403).json({ error: "Upgrade to Pro or Enterprise to request payouts" });
  }

  const { amountNL, payoutMethod: methodRaw } = req.body;
  const payoutMethod: PayoutMethod = methodRaw === "WISE" ? "WISE" : "STRIPE";

  if (!amountNL || typeof amountNL !== "number" || amountNL <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (payoutMethod === "STRIPE") {
    if (!user.stripeConnectId) {
      return res.status(400).json({ error: "Connect your Stripe account first" });
    }
    if (!user.stripeConnectOnboarded) {
      const status = await checkConnectStatus(user.stripeConnectId);
      if (!status.isOnboarded) {
        return res.status(400).json({ error: "Complete Stripe onboarding before requesting payouts" });
      }
    }
  } else {
    if (!user.iban || !user.ibanAccountHolder || !user.wiseRecipientId) {
      return res.status(400).json({ error: "Set up your IBAN in Wise settings before requesting payouts" });
    }
  }

  try {
    const payout = await requestPayout(session.user.id, Math.floor(amountNL), payoutMethod);

    if (payoutMethod === "STRIPE") {
      const result = await executeStripePayout(
        payout.id,
        user.stripeConnectId!,
        payout.amountCents
      );

      if (result.success) {
        if (user.emailNotifications) {
          const amountDisplay = `$${(Math.floor(amountNL) * NL_TO_USD_CENTS / 100).toFixed(2)}`;
          sendPayoutEmail(user.email, user.name, {
            amountNL: Math.floor(amountNL),
            amountDisplay,
            method: "Stripe Connect",
            currency: "USD",
          }).catch(() => {});
        }
        return res.json({
          success: true,
          payout: { ...payout, stripeTransferId: result.transferId, status: "COMPLETED" },
        });
      } else {
        return res.status(500).json({ error: "Stripe transfer failed", message: result.error });
      }
    } else {
      const result = await executeWisePayout(
        payout.id,
        user.wiseRecipientId!,
        payout.amountCents
      );

      if (result.success) {
        if (user.emailNotifications) {
          const amountDisplay = `€${(Math.floor(amountNL) * NL_TO_EUR_CENTS / 100).toFixed(2)}`;
          sendPayoutEmail(user.email, user.name, {
            amountNL: Math.floor(amountNL),
            amountDisplay,
            method: "Wise (IBAN)",
            currency: "EUR",
          }).catch(() => {});
        }
        return res.json({
          success: true,
          payout: { ...payout, wiseTransferId: result.transferId, status: "COMPLETED" },
        });
      } else {
        return res.status(500).json({ error: "Wise transfer failed", message: result.error });
      }
    }
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Payout failed",
    });
  }
}
