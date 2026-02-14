/**
 * JWT signé pour token d'accès SaaS (HS256). Payload: userId, partnerId, exp.
 * Le SaaS peut vérifier via GET /api/access/verify?token=xxx
 */
import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "nolink-dev-secret"
);
const EXPIRY_MS = 15 * 60 * 1000; // 15 min

export type AccessPayload = { userId: string; partnerId: string; exp: number };

export async function signAccessToken(userId: string, partnerId: string): Promise<string> {
  return new SignJWT({ userId, partnerId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + EXPIRY_MS / 1000)
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.userId || !payload.partnerId || !payload.exp) return null;
    return payload as unknown as AccessPayload;
  } catch {
    return null;
  }
}
