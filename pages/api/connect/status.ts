import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { checkConnectStatus, markConnectOnboarded } from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.stripeConnectId) {
    return res.json({
      connected: false,
      onboarded: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    });
  }

  try {
    const status = await checkConnectStatus(user.stripeConnectId);

    if (status.isOnboarded && !user.stripeConnectOnboarded) {
      await markConnectOnboarded(user.id);
    }

    return res.json({
      connected: true,
      onboarded: status.isOnboarded,
      ...status,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to check connect status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
