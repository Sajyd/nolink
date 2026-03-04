import type { SubscriptionTier } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      bonusBalance: number;
      purchasedBalance: number;
      earnedBalance: number;
      subscription: SubscriptionTier;
      payoutVerified: boolean;
    };
  }

  interface User {
    id: string;
    bonusBalance: number;
    purchasedBalance: number;
    earnedBalance: number;
    subscription: SubscriptionTier;
    payoutVerified: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    bonusBalance: number;
    purchasedBalance: number;
    earnedBalance: number;
    subscription: SubscriptionTier;
    payoutVerified: boolean;
  }
}
