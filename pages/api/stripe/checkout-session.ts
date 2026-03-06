import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrCreateStripeCustomer, getStripeClient } from "@/lib/stripe";

// ~4 cents/NL — aligned with pack_500 rate ($19.99 / 500 NL)
const CENTS_PER_NL = 4;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Sign in to refill Nolinks" });
  }

  const amount = req.method === "POST" ? (req.body?.amount as number) : 500;
  const nolinks = Math.max(100, Math.min(10000, Number(amount) || 500));
  const amountCents = nolinks * CENTS_PER_NL;

  try {
    const customerId = await getOrCreateStripeCustomer(session.user.id);
    const stripe = getStripeClient();

    const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${nolinks} Nolinks`,
              description: "Platform credits for running AI workflows",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?tab=credits&refill=1`,
      cancel_url: `${origin}/dashboard?tab=credits`,
      metadata: {
        userId: session.user.id,
        nolinks: String(nolinks),
      },
    });

    if (req.method === "GET") {
      return res.redirect(303, checkoutSession.url!);
    }
    return res.json({ url: checkoutSession.url, nolinks });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create checkout session",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
