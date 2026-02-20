import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === "GET") {
    const workflow = await prisma.workflow.findUnique({
      where: { id: id as string },
      include: {
        creator: { select: { id: true, name: true, image: true } },
        steps: { orderBy: { order: "asc" } },
        _count: { select: { executions: true } },
      },
    });

    if (!workflow) return res.status(404).json({ error: "Workflow not found" });

    // Private workflow access control
    if (!workflow.isPublic) {
      const session = await getServerSession(req, res, authOptions);
      if (!session || session.user.id !== workflow.creator.id) {
        return res.status(403).json({ error: "This workflow is private" });
      }
    }

    return res.json(workflow);
  }

  if (req.method === "PUT") {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const workflow = await prisma.workflow.findUnique({
      where: { id: id as string },
    });

    if (!workflow || workflow.creatorId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, description, category, priceInNolinks, isPublic } = req.body;

    const updated = await prisma.workflow.update({
      where: { id: id as string },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(priceInNolinks !== undefined && { priceInNolinks }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    return res.json(updated);
  }

  if (req.method === "DELETE") {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const workflow = await prisma.workflow.findUnique({
      where: { id: id as string },
    });

    if (!workflow || workflow.creatorId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.workflow.delete({ where: { id: id as string } });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
