import type { NextApiRequest, NextApiResponse } from "next";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const hashedPassword = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: name || email.split("@")[0],
      email,
      hashedPassword,
      purchasedBalance: 100,
    },
  });

  return res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
}
