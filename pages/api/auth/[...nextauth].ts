import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.hashedPassword) return null;

        const isValid = await compare(credentials.password, user.hashedPassword);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          purchasedBalance: user.purchasedBalance,
          earnedBalance: user.earnedBalance,
          subscription: user.subscription,
          stripeConnectOnboarded: user.stripeConnectOnboarded,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            purchasedBalance: true,
            earnedBalance: true,
            subscription: true,
            stripeConnectOnboarded: true,
          },
        });
        if (dbUser) {
          token.purchasedBalance = dbUser.purchasedBalance;
          token.earnedBalance = dbUser.earnedBalance;
          token.subscription = dbUser.subscription;
          token.stripeConnectOnboarded = dbUser.stripeConnectOnboarded;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.purchasedBalance = token.purchasedBalance ?? 0;
      session.user.earnedBalance = token.earnedBalance ?? 0;
      session.user.subscription = token.subscription ?? "FREE";
      session.user.stripeConnectOnboarded = token.stripeConnectOnboarded ?? false;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
