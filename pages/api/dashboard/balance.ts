import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nolinksBalance: true },
  });
  return res.json({ nolinksBalance: user?.nolinksBalance ?? 0 });
}
