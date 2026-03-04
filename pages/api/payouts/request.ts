import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { requestPayout } from "@/lib/credits";
import { executeWisePayout } from "@/lib/wise";
import prisma from "@/lib/prisma";
import { PAYOUT_ELIGIBLE_TIERS } from "@/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!PAYOUT_ELIGIBLE_TIERS.includes(session.user.subscription as any)) {
    return res.status(403).json({ error: "Upgrade to Pro or Enterprise to request payouts" });
  }

  const { amountNL } = req.body;
  if (!amountNL || typeof amountNL !== "number" || amountNL <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.wiseRecipientId || !user.payoutVerified) {
    return res.status(400).json({ error: "Add your bank details before requesting a payout" });
  }

  try {
    const payout = await requestPayout(session.user.id, Math.floor(amountNL));

    const result = await executeWisePayout(
      payout.id,
      parseInt(user.wiseRecipientId),
      payout.amountCents,
      user.payoutCurrency
    );

    if (result.success) {
      return res.json({
        success: true,
        payout: { ...payout, wiseTransferId: String(result.transferId), status: "COMPLETED" },
      });
    } else {
      return res.status(500).json({
        error: "Payout transfer failed",
        message: result.error,
      });
    }
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Payout failed",
    });
  }
}
