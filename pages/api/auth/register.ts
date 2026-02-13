import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok?: boolean; error?: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, name } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const emailTrim = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return res.status(400).json({ error: "Email invalide" });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      error: "Le mot de passe doit contenir au moins 8 caractères",
    });
  }

  const existing = await prisma.user.findUnique({
    where: { email: emailTrim },
  });

  if (existing) {
    return res.status(409).json({ error: "Un compte existe déjà avec cet email" });
  }

  const hashed = await bcrypt.hash(String(password), 12);

  await prisma.user.create({
    data: {
      email: emailTrim,
      password: hashed,
      name: name ? String(name).trim() || null : null,
    },
  });

  return res.status(201).json({ ok: true });
}
