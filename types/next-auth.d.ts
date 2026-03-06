import type { SubscriptionTier, PayoutMethod } from "@prisma/client";
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
      stripeConnectOnboarded: boolean;
      payoutMethod: PayoutMethod | null;
      iban: string | null;
      ibanAccountHolder: string | null;
      brandName: string | null;
      brandLogoUrl: string | null;
    };
  }

  interface User {
    id: string;
    bonusBalance: number;
    purchasedBalance: number;
    earnedBalance: number;
    subscription: SubscriptionTier;
    stripeConnectOnboarded: boolean;
    payoutMethod: PayoutMethod | null;
    iban: string | null;
    ibanAccountHolder: string | null;
    brandName: string | null;
    brandLogoUrl: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    bonusBalance: number;
    purchasedBalance: number;
    earnedBalance: number;
    subscription: SubscriptionTier;
    stripeConnectOnboarded: boolean;
    payoutMethod: PayoutMethod | null;
    iban: string | null;
    ibanAccountHolder: string | null;
    brandName: string | null;
    brandLogoUrl: string | null;
  }
}
