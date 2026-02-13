/**
 * POST /api/auth/forgot-password
 * Génère un token de réinitialisation (VerificationToken), envoie le lien par email si configuré (RESEND_API_KEY), sinon log en dev.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import crypto from "crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok?: boolean; error?: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body ?? {};
  const emailTrim = String(email).trim().toLowerCase();
  if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return res.status(400).json({ error: "Email invalide" });
  }

  const user = await prisma.user.findUnique({ where: { email: emailTrim } });
  if (!user) {
    return res.status(200).json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier: emailTrim } });
  await prisma.verificationToken.create({
    data: { identifier: emailTrim, token, expires },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

  if (process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "nolink@example.com",
          to: emailTrim,
          subject: "Réinitialisation de votre mot de passe Nolink",
          text: `Cliquez pour réinitialiser : ${resetUrl}`,
        }),
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Erreur d'envoi email" });
    }
  } else {
    console.log("[dev] Reset password link:", resetUrl);
  }

  return res.status(200).json({ ok: true });
}
