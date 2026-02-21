import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckout,
} from "@/lib/stripe";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { tier } = req.body;
  const plan = SUBSCRIPTION_PLANS.find((p) => p.tier === tier);

  if (!plan || plan.priceInCents === 0) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  const tierOrder = ["FREE", "STARTER", "PRO", "POWER"];
  const currentIdx = tierOrder.indexOf(session.user.subscription);
  const targetIdx = tierOrder.indexOf(tier);

  if (targetIdx <= currentIdx) {
    return res
      .status(400)
      .json({ error: "You can only upgrade to a higher plan" });
  }

  const origin = req.headers.origin || "http://localhost:3000";

  try {
    const customerId = await getOrCreateStripeCustomer(session.user.id);

    const checkoutSession = await createSubscriptionCheckout(
      customerId,
      tier,
      session.user.id,
      `${origin}/dashboard?upgraded=${tier}`,
      `${origin}/dashboard?tab=credits`
    );

    return res.json({ url: checkoutSession.url });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create checkout session",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
