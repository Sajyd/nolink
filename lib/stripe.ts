/**
 * Client Stripe (STRIPE_SECRET_KEY). Utilisé pour Checkout, Portal, Webhooks.
 */
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
export default stripe;
