import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import {
  createConnectAccount,
  createConnectOnboardingLink,
} from "@/lib/stripe";
import { PAYOUT_ELIGIBLE_TIERS } from "@/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (!PAYOUT_ELIGIBLE_TIERS.includes(session.user.subscription as any)) {
    return res.status(403).json({ error: "Upgrade to Pro to connect Stripe" });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const origin = req.headers.origin || "http://localhost:3000";

  try {
    let connectId = user.stripeConnectId;

    if (!connectId) {
      const account = await createConnectAccount(user.id, user.email);
      connectId = account.id;
    }

    const url = await createConnectOnboardingLink(
      connectId,
      `${origin}/dashboard?tab=earnings&connect=refresh`,
      `${origin}/dashboard?tab=earnings&connect=complete`
    );

    return res.json({ url });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create connect onboarding",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
