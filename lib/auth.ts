/**
 * Configuration NextAuth : Credentials (email/password), Google, GitHub ; JWT ; callbacks session (user.id) ; page signin personnalisée.
 */
import NextAuth, { type Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Compte Nolink",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.password) return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session?.user) session.user.id = token.sub ?? "";
      return session;
    },
    async jwt({ token }: { token: JWT }) {
      return token;
    },
  },
  pages: { signIn: "/auth/signin" },
  secret: process.env.NEXTAUTH_SECRET,
};

/** JWT secret pour tokens d'accès Nolink (SaaS). */
function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "nolink-dev-secret"
  );
}

const JWT_ACCESS_EXPIRY_SEC = 15 * 60; // 15 min

/** Génère un JWT d'accès pour userId + partnerId (accès immédiat au SaaS). */
export async function signAccessToken(userId: string, partnerId: string): Promise<string> {
  const { SignJWT } = await import("jose");
  return new SignJWT({ userId, partnerId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + JWT_ACCESS_EXPIRY_SEC)
    .sign(getJwtSecret());
}

/** Vérifie un JWT d'accès et retourne { userId, partnerId } ou null. */
export async function verifyAccessToken(token: string): Promise<{ userId: string; partnerId: string } | null> {
  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.userId || !payload.partnerId) return null;
    return { userId: String(payload.userId), partnerId: String(payload.partnerId) };
  } catch {
    return null;
  }
}

export default NextAuth(authOptions);
