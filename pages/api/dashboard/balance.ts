import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bonusBalance: true, purchasedBalance: true, earnedBalance: true },
  });
  return res.json({
    bonusBalance: user?.bonusBalance ?? 0,
    purchasedBalance: user?.purchasedBalance ?? 0,
    earnedBalance: user?.earnedBalance ?? 0,
    totalBalance: (user?.bonusBalance ?? 0) + (user?.purchasedBalance ?? 0) + (user?.earnedBalance ?? 0),
  });
}
