import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { requestPayout } from "@/lib/credits";
import { executeStripePayout } from "@/lib/stripe";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { amountNL } = req.body;
  if (!amountNL || typeof amountNL !== "number" || amountNL <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const payout = await requestPayout(session.user.id, Math.floor(amountNL));

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.stripeConnectId) {
      return res.status(400).json({ error: "Stripe Connect not configured" });
    }

    const result = await executeStripePayout(
      payout.id,
      user.stripeConnectId,
      payout.amountCents
    );

    if (result.success) {
      return res.json({
        success: true,
        payout: { ...payout, stripeTransferId: result.transferId, status: "COMPLETED" },
      });
    } else {
      return res.status(500).json({
        error: "Stripe transfer failed",
        message: result.error,
      });
    }
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Payout failed",
    });
  }
}
