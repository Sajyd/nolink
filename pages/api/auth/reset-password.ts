/**
 * POST /api/auth/reset-password
 * Valide le token (VerificationToken), met à jour le mot de passe du user (identifier = email), supprime le token.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok?: boolean; error?: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, password } = req.body ?? {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token requis" });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
  }

  const vt = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!vt || vt.expires < new Date()) {
    return res.status(400).json({ error: "Lien invalide ou expiré." });
  }

  const email = vt.identifier;
  const hashed = await bcrypt.hash(String(password), 12);

  await prisma.user.update({
    where: { email },
    data: { password: hashed },
  });
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return res.status(200).json({ ok: true });
}
