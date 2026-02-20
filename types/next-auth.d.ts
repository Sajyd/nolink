import type { SubscriptionTier } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      purchasedBalance: number;
      earnedBalance: number;
      subscription: SubscriptionTier;
      stripeConnectOnboarded: boolean;
    };
  }

  interface User {
    id: string;
    purchasedBalance: number;
    earnedBalance: number;
    subscription: SubscriptionTier;
    stripeConnectOnboarded: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    purchasedBalance: number;
    earnedBalance: number;
    subscription: SubscriptionTier;
    stripeConnectOnboarded: boolean;
  }
}
