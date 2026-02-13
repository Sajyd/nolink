/**
 * GET /api/auth/verify-email?token=...
 * Valide le token (VerificationToken, identifier = email), marque User.emailVerified, supprime le token.
 * Pour l’envoi du lien après inscription, documenter RESEND_API_KEY ou équivalent.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok?: boolean; error?: string }>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.query.token as string | undefined;
  if (!token) return res.status(400).json({ error: "Token requis" });

  const vt = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!vt || vt.expires < new Date()) {
    return res.status(400).json({ error: "Lien invalide ou expiré." });
  }

  const email = vt.identifier;
  await prisma.user.updateMany({
    where: { email },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return res.status(200).json({ ok: true });
}
