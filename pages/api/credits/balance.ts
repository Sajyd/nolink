import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      bonusBalance: true,
      purchasedBalance: true,
      earnedBalance: true,
      subscription: true,
      payoutVerified: true,
    },
  });

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return res.json({
    bonusBalance: user?.bonusBalance ?? 0,
    purchasedBalance: user?.purchasedBalance ?? 0,
    earnedBalance: user?.earnedBalance ?? 0,
    totalBalance: (user?.bonusBalance ?? 0) + (user?.purchasedBalance ?? 0) + (user?.earnedBalance ?? 0),
    subscription: user?.subscription ?? "FREE",
    payoutVerified: user?.payoutVerified ?? false,
    transactions,
  });
}
