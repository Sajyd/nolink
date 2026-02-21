import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { createConnectLoginLink } from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeConnectId) {
    return res.status(400).json({ error: "Stripe Connect not configured" });
  }

  if (!user.stripeConnectOnboarded) {
    return res.status(400).json({ error: "Complete onboarding first" });
  }

  try {
    const url = await createConnectLoginLink(user.stripeConnectId);
    return res.json({ url });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create dashboard link",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
