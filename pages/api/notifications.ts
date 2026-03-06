import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const userId = session.user.id;

  if (req.method === "GET") {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    return res.json({
      notifications,
      unreadCount,
      nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
    });
  }

  if (req.method === "PATCH") {
    const { ids, markAllRead } = req.body;

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
      return res.json({ success: true });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId },
        data: { read: true },
      });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Provide ids or markAllRead" });
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    if (id) {
      await prisma.notification.deleteMany({ where: { id, userId } });
      return res.json({ success: true });
    }
    return res.status(400).json({ error: "Provide notification id" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
