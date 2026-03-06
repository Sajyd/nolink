import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { SUPPORT_ADMIN_EMAILS, TICKET_ELIGIBLE_TIERS } from "@/lib/constants";
import { notifySupportReply } from "@/lib/notifications";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const isAdmin = SUPPORT_ADMIN_EMAILS.includes(session.user.email as any);
  const canUseTickets =
    isAdmin || TICKET_ELIGIBLE_TIERS.includes(session.user.subscription as any);

  if (!canUseTickets) {
    return res.status(403).json({ error: "Ticket support requires a Pro or Enterprise plan" });
  }

  const ticketId = req.query.id as string;
  const { body } = req.body;

  if (!body?.trim()) {
    return res.status(400).json({ error: "Message body is required" });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (!isAdmin && ticket.userId !== session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (ticket.status === "CLOSED") {
    return res.status(400).json({ error: "Cannot reply to a closed ticket" });
  }

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId,
        userId: session.user.id,
        body: body.trim(),
        isAdmin,
      },
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: isAdmin ? "IN_PROGRESS" : undefined,
        updatedAt: new Date(),
      },
    }),
  ]);

  if (isAdmin && ticket.userId !== session.user.id) {
    notifySupportReply(ticket.userId, ticket.subject, ticketId).catch(() => {});
  }

  return res.status(201).json(message);
}
