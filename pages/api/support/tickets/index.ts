import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { SUPPORT_ADMIN_EMAILS, TICKET_ELIGIBLE_TIERS } from "@/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const isAdmin = SUPPORT_ADMIN_EMAILS.includes(session.user.email as any);
  const canUseTickets =
    isAdmin || TICKET_ELIGIBLE_TIERS.includes(session.user.subscription as any);

  if (!canUseTickets) {
    return res.status(403).json({ error: "Ticket support requires a Pro or Enterprise plan" });
  }

  if (req.method === "GET") {
    const where = isAdmin ? {} : { userId: session.user.id };

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, image: true, subscription: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(tickets);
  }

  if (req.method === "POST") {
    const { subject, body, priority } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "Subject and message body are required" });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.user.id,
        subject: subject.trim(),
        priority: priority || "MEDIUM",
        messages: {
          create: {
            userId: session.user.id,
            body: body.trim(),
            isAdmin: false,
          },
        },
      },
      include: {
        messages: true,
        user: { select: { name: true, email: true, image: true, subscription: true } },
      },
    });

    return res.status(201).json(ticket);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
