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

  const ticketId = req.query.id as string;

  if (req.method === "GET") {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { name: true, email: true, image: true, subscription: true } },
        messages: {
          include: {
            user: { select: { name: true, email: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isAdmin && ticket.userId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(ticket);
  }

  if (req.method === "PATCH") {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isAdmin && ticket.userId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { status } = req.body;
    const allowedStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (!isAdmin && !["CLOSED"].includes(status)) {
      return res.status(403).json({ error: "Only admin can change ticket status" });
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
      include: {
        user: { select: { name: true, email: true, image: true, subscription: true } },
        messages: {
          include: {
            user: { select: { name: true, email: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return res.json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
