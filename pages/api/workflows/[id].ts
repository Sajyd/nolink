import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateWorkflowCost, type StepDefinition } from "@/lib/ai-engine";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).end();
  if (req.method === "GET") {
    const workflow = await prisma.workflow.findFirst({
      where: { id, isPublic: true },
      include: {
        creator: { select: { name: true, image: true } },
        steps: { orderBy: { order: "asc" } },
      },
    });
    if (!workflow) {
      const byUrl = await prisma.workflow.findUnique({
        where: { publicUrl: id },
        include: {
          creator: { select: { name: true, image: true } },
          steps: { orderBy: { order: "asc" } },
        },
      });
      if (byUrl) return res.json(byUrl);
      return res.status(404).json({ error: "Workflow not found" });
    }
    return res.json(workflow);
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  if (req.method === "PATCH") {
    const w = await prisma.workflow.findFirst({
      where: { id, creatorId: session.user.id },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!w) return res.status(404).json({ error: "Not found" });
    const body = req.body as Partial<{
      name: string;
      description: string;
      category: string;
      priceInNolinks: number;
      isPublic: boolean;
    }>;
    let enforcedPrice: number | undefined;
    if (body.priceInNolinks != null) {
      const minCost = estimateWorkflowCost(w.steps as unknown as StepDefinition[]);
      enforcedPrice = Math.max(body.priceInNolinks, minCost);
    }
    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.description != null && { description: body.description }),
        ...(body.category != null && { category: body.category }),
        ...(enforcedPrice != null && { priceInNolinks: enforcedPrice }),
        ...(body.isPublic != null && { isPublic: body.isPublic }),
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    return res.json(updated);
  }
  if (req.method === "DELETE") {
    const w = await prisma.workflow.findFirst({ where: { id, creatorId: session.user.id } });
    if (!w) return res.status(404).json({ error: "Not found" });
    await prisma.workflow.delete({ where: { id } });
    return res.status(204).end();
  }
  return res.status(405).end();
}
