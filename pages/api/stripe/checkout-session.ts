import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const NOLINKS_PER_DOLLAR = 100; // $1 = 100 Nolinks

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Sign in to refill Nolinks" });
  }
  const amount = req.method === "POST" ? (req.body?.amount as number) : 500; // default 500 Nolinks
  const nolinks = Math.max(100, Math.min(10000, Number(amount) || 500));
  const amountCents = Math.ceil((nolinks / NOLINKS_PER_DOLLAR) * 100);

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  let customerId = user.stripeCustomerId;
  if (!customerId && process.env.STRIPE_SECRET_KEY) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: "Payments not configured",
      message: "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable refills.",
    });
  }

  const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const sessionStripe = await stripe.checkout.sessions.create({
    customer: customerId ?? undefined,
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
    return res.redirect(303, sessionStripe.url!);
  }
  return res.json({ url: sessionStripe.url, nolinks });
}
