import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const googleProfile = profile as { picture?: string };

        let dbUser = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: profile.email,
              name: profile.name ?? user.name,
              image: googleProfile.picture ?? user.image,
              emailVerified: new Date(),
            },
          });
        } else if (!dbUser.name || !dbUser.image) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              name: dbUser.name || profile.name,
              image: dbUser.image || googleProfile.picture,
            },
          });
        }

        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          create: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token as string | undefined,
            session_state: account.session_state as string | undefined,
          },
          update: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
          },
        });

        user.id = dbUser.id;
      }
      return true;
    },
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
