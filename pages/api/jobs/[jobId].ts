import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { getModelById } from "@/lib/models";
import { EXECUTION_TIMEOUT_MS } from "@/lib/constants";

const HEARTBEAT_STALE_MS = 30_000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const { jobId } = req.query;

  const execution = await prisma.execution.findUnique({
    where: { id: jobId as string },
    include: {
      workflow: {
        include: { steps: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!execution) {
    return res.status(404).json({ error: "Job not found" });
  }

  // Allow anonymous access for anonymous executions (userId is null, secured by CUID)
  // For authenticated executions, require ownership
  if (execution.userId) {
    if (!session) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (execution.userId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const visibleSteps = execution.workflow.steps.filter(
    (s) => s.stepType !== "INPUT" && s.stepType !== "OUTPUT"
  );

  const stepResults = (execution.stepResults as any[]) || [];

  const steps = visibleSteps.map((s, i) => {
    const result = stepResults.find((r: any) => r.stepId === s.id);
    return {
      index: i + 1,
      stepId: s.id,
      stepName: s.name,
      stepType: s.stepType,
      outputType: s.outputType,
      aiModel: s.aiModel,
      modelName: s.aiModel
        ? getModelById(s.aiModel)?.name || s.aiModel
        : null,
      status: result
        ? result.output?.startsWith("Error:")
          ? "error"
          : "completed"
        : execution.status === "RUNNING"
          ? i === stepResults.length
            ? "running"
            : "pending"
          : "pending",
      output: result?.output ?? null,
      duration: result?.duration ?? null,
    };
  });

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const totalSteps = steps.length;

  // Detect stalled execution: RUNNING but heartbeat is stale
  const heartbeatStale =
    execution.status === "RUNNING" &&
    (!execution.lastHeartbeat ||
      Date.now() - execution.lastHeartbeat.getTime() > HEARTBEAT_STALE_MS);

  // If heartbeat is stale, the function was killed or saved state and exited.
  // resumeState set → can continue from saved checkpoint.
  // resumeState null → function was killed before saving — still signal continuation
  //   so the continue endpoint can restart the in-progress step.
  const needsContinuation = heartbeatStale;

  // Tier timeout
  const tier = session?.user?.subscription || "FREE";
  const maxTimeoutMs = EXECUTION_TIMEOUT_MS[tier] || EXECUTION_TIMEOUT_MS.FREE;
  const elapsedMs = Date.now() - execution.startedAt.getTime();

  const response: Record<string, any> = {
    jobId: execution.id,
    status: execution.status,
    workflowId: execution.workflowId,
    workflowName: execution.workflow.name,
    progress: {
      completed: completedSteps,
      total: totalSteps,
      percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    },
    steps,
    creditsUsed: execution.creditsUsed,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    elapsedMs,
    maxTimeoutMs,
    needsContinuation,
  };

  if (execution.status === "COMPLETED" || execution.status === "FAILED") {
    const outputs = execution.outputs as any;
    response.result = outputs?.final ?? null;
  }

  if (execution.status === "FAILED") {
    response.error = execution.errorMessage ?? null;
  }

  return res.status(200).json(response);
}
