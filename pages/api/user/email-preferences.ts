import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailNotifications: true, emailMarketing: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  }

  if (req.method === "PUT") {
    const { emailNotifications, emailMarketing } = req.body;

    if (typeof emailNotifications !== "boolean" || typeof emailMarketing !== "boolean") {
      return res.status(400).json({ error: "emailNotifications and emailMarketing must be booleans" });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailNotifications, emailMarketing },
    });

    return res.json({ success: true, emailNotifications, emailMarketing });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
