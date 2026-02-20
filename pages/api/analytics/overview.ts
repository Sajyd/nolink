import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const workflows = await prisma.workflow.findMany({
    where: { creatorId: session.user.id },
    select: {
      id: true,
      name: true,
      totalUses: true,
      totalEarnings: true,
      priceInNolinks: true,
      isPublic: true,
      createdAt: true,
      _count: { select: { executions: true } },
    },
    orderBy: { totalEarnings: "desc" },
  });

  // Last 30 days of analytics across all workflows
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const workflowIds = workflows.map((w) => w.id);

  const dailyStats = workflowIds.length > 0
    ? await prisma.workflowAnalytics.findMany({
        where: {
          workflowId: { in: workflowIds },
          date: { gte: thirtyDaysAgo },
        },
        orderBy: { date: "asc" },
      })
    : [];

  // Aggregate daily totals
  const dailyTotals: Record<string, { runs: number; revenueNL: number }> = {};
  for (const stat of dailyStats) {
    const dateKey = stat.date.toISOString().split("T")[0];
    if (!dailyTotals[dateKey]) dailyTotals[dateKey] = { runs: 0, revenueNL: 0 };
    dailyTotals[dateKey].runs += stat.runs;
    dailyTotals[dateKey].revenueNL += stat.revenueNL;
  }

  const chartData = Object.entries(dailyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  const totalEarnings = workflows.reduce((s, w) => s + w.totalEarnings, 0);
  const totalRuns = workflows.reduce((s, w) => s + w.totalUses, 0);

  // Per-workflow breakdown
  const perWorkflow = await prisma.workflowAnalytics.groupBy({
    by: ["workflowId"],
    where: {
      workflowId: { in: workflowIds },
      date: { gte: thirtyDaysAgo },
    },
    _sum: { runs: true, revenueNL: true },
  });

  const workflowBreakdown = workflows.map((w) => {
    const stats = perWorkflow.find((p) => p.workflowId === w.id);
    return {
      id: w.id,
      name: w.name,
      totalUses: w.totalUses,
      totalEarnings: w.totalEarnings,
      isPublic: w.isPublic,
      last30dRuns: stats?._sum.runs || 0,
      last30dRevenue: stats?._sum.revenueNL || 0,
    };
  });

  return res.json({
    totalEarnings,
    totalRuns,
    workflowCount: workflows.length,
    chartData,
    workflows: workflowBreakdown,
  });
}
