import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { workflowId } = req.query;

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId as string },
    select: {
      id: true,
      name: true,
      creatorId: true,
      totalUses: true,
      totalEarnings: true,
      priceInNolinks: true,
      isPublic: true,
      createdAt: true,
    },
  });

  if (!workflow) return res.status(404).json({ error: "Workflow not found" });
  if (workflow.creatorId !== session.user.id) {
    return res.status(403).json({ error: "Not your workflow" });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyStats = await prisma.workflowAnalytics.findMany({
    where: {
      workflowId: workflow.id,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: "asc" },
  });

  const recentExecutions = await prisma.execution.findMany({
    where: { workflowId: workflow.id },
    select: {
      id: true,
      status: true,
      creditsUsed: true,
      startedAt: true,
      completedAt: true,
      user: { select: { name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return res.json({
    workflow,
    dailyStats: dailyStats.map((s) => ({
      date: s.date.toISOString().split("T")[0],
      runs: s.runs,
      revenueNL: s.revenueNL,
      uniqueUsers: s.uniqueUsers,
    })),
    recentExecutions,
  });
}
