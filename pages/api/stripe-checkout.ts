import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import stripe from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).redirect("/");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const priceId = process.env.STRIPE_PRICE_ID_PRO;
  if (!stripe || !priceId) {
    return res.status(500).json({ error: "Stripe non configuré" });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?success=1`,
      cancel_url: `${baseUrl}/dashboard`,
      customer_email: session.user.email,
      metadata: { user_id: session.user.id },
    });
    const url = checkoutSession.url;
    if (url) return res.redirect(303, url);
    return res.status(500).json({ error: "Erreur Stripe" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur Stripe" });
  }
}
