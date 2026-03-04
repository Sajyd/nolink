import type { NextApiRequest, NextApiResponse } from "next";
import { buffer } from "micro";
import prisma from "@/lib/prisma";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const signature = req.headers["x-signature-sha256withrsa"] as string;
  if (!signature) {
    return res.status(400).json({ error: "Missing signature" });
  }

  const buf = await buffer(req);
  const event = JSON.parse(buf.toString());

  // Wise sends transfer_state_change events when transfer status changes
  if (event.event_type === "transfers#state-change") {
    const { resource } = event.data;
    const wiseTransferId = String(resource?.id);
    const newState = resource?.current_state;

    if (!wiseTransferId || !newState) {
      return res.json({ received: true });
    }

    const payout = await prisma.payout.findFirst({
      where: { wiseTransferId },
    });

    if (!payout) {
      return res.json({ received: true });
    }

    if (newState === "outgoing_payment_sent" || newState === "funds_converted") {
      if (payout.status !== "COMPLETED") {
        await prisma.payout.update({
          where: { id: payout.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
    }

    if (
      newState === "cancelled" ||
      newState === "funds_refunded" ||
      newState === "bounced_back"
    ) {
      if (payout.status !== "FAILED") {
        await prisma.$transaction([
          prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: "FAILED",
              failureReason: `Wise transfer ${newState}`,
            },
          }),
          prisma.user.update({
            where: { id: payout.userId },
            data: { earnedBalance: { increment: payout.amountNL } },
          }),
          prisma.creditTransaction.create({
            data: {
              userId: payout.userId,
              amount: payout.amountNL,
              type: "PAYOUT_REVERSAL",
              wallet: "earned",
              reason: `Payout reversed (${newState}) — ${payout.amountNL} NL refunded`,
            },
          }),
        ]);
      }
    }
  }

  return res.json({ received: true });
}
