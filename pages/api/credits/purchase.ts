import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { createCheckoutSession, getOrCreateStripeCustomer } from "@/lib/stripe";
import { CREDIT_PACKAGES } from "@/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { packageId } = req.body;
  const pack = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pack) return res.status(400).json({ error: "Invalid package" });

  const origin = req.headers.origin || "http://localhost:3000";

  try {
    const customerId = await getOrCreateStripeCustomer(session.user.id);

    const checkoutSession = await createCheckoutSession(
      customerId,
      packageId,
      `${origin}/dashboard?purchase=success`,
      `${origin}/dashboard?purchase=cancelled`
    );

    return res.json({ url: checkoutSession.url });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create checkout session",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
