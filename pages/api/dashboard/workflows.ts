import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  const workflows = await prisma.workflow.findMany({
    where: { creatorId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      publicUrl: true,
      priceInNolinks: true,
      totalUses: true,
      totalEarnings: true,
      isPublic: true,
    },
  });
  return res.json({ workflows });
}
