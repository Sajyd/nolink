import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { type StepDefinition, type StepCustomParam, type FileInput, type StepResult } from "@/lib/ai-engine";
import { executeWorkflowGraph, type ResumeState } from "@/lib/graph-executor";
import { deductCredits } from "@/lib/credits";
import { estimateWorkflowCost } from "@/lib/ai-engine";
import { EXECUTION_TIMEOUT_MS } from "@/lib/constants";
import { waitUntil } from "@vercel/functions";

export const config = {
  maxDuration: 800,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const { executionId } = req.body;

  if (!executionId) {
    return res.status(400).json({ error: "executionId is required" });
  }

  const session = await getServerSession(req, res, authOptions);

  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      workflow: {
        include: { steps: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!execution) {
    return res.status(404).json({ error: "Execution not found" });
  }

  // Auth: allow owner or anonymous executions (userId is null)
  if (execution.userId && session?.user?.id !== execution.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (execution.workflowId !== id) {
    return res.status(400).json({ error: "Execution does not belong to this workflow" });
  }

  if (execution.status === "COMPLETED" || execution.status === "FAILED") {
    return res.status(400).json({ error: "Execution already finished", status: execution.status });
  }

  // Check tier-based timeout
  const tier = session?.user?.subscription || "FREE";
  const maxTimeout = EXECUTION_TIMEOUT_MS[tier] || EXECUTION_TIMEOUT_MS.FREE;
  const elapsed = Date.now() - execution.startedAt.getTime();
  if (elapsed > maxTimeout) {
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        errorMessage: "Execution timed out",
        completedAt: new Date(),
      },
    });
    return res.status(408).json({ error: "Execution timed out" });
  }

  const resumeState = execution.resumeState as ResumeState | null;
  if (!resumeState) {
    return res.status(400).json({ error: "No resume state available" });
  }

  const workflow = execution.workflow;
  const isAnonymous = !execution.userId;
  const baseCost = estimateWorkflowCost(workflow.steps as unknown as StepDefinition[]);
  const cost = Math.max(workflow.priceInNolinks, baseCost);

  // Mark as running again and update heartbeat
  await prisma.execution.update({
    where: { id: executionId },
    data: { status: "RUNNING", lastHeartbeat: new Date(), resumeState: Prisma.DbNull },
  });

  // Respond immediately — execution continues in background via waitUntil
  res.status(200).json({ ok: true });

  waitUntil(runContinuation(executionId, workflow, execution, resumeState, isAnonymous, cost, baseCost));
}

async function runContinuation(
  executionId: string,
  workflow: any,
  execution: any,
  resumeState: ResumeState,
  isAnonymous: boolean,
  cost: number,
  baseCost: number,
) {
  // Build step definitions
  const stepDefs: StepDefinition[] = workflow.steps.map((s: any) => {
    const config = (s.config as Record<string, unknown>) || {};

    let stepCustomParams = (config.customParams as StepCustomParam[] | undefined) || undefined;
    if (s.stepType === "INPUT" && stepCustomParams) {
      const inputParamNames = new Set(
        ((config.inputParameters as { name: string }[]) || []).map((p: { name: string }) => p.name).filter(Boolean)
      );
      if (inputParamNames.size > 0) {
        stepCustomParams = stepCustomParams.filter((cp: StepCustomParam) => !inputParamNames.has(cp.name));
        if (stepCustomParams.length === 0) stepCustomParams = undefined;
      }
    }

    return {
      id: s.id,
      order: s.order,
      name: s.name,
      stepType: s.stepType,
      aiModel: s.aiModel,
      inputType: s.inputType,
      outputType: s.outputType,
      prompt: s.prompt,
      systemPrompt: (s as any).systemPrompt || "",
      params: s.params as Record<string, unknown> | null,
      acceptTypes: s.acceptTypes,
      customParams: stepCustomParams,
      customFalEndpoint: (config.customFalEndpoint as string | undefined) || undefined,
      customFalParams: (config.customFalParams as { key: string; value: string }[] | undefined) || undefined,
      customFalPrice: (config.customFalPrice as number | undefined) ?? undefined,
      customFalCostPerSecond: (config.customFalCostPerSecond as number | undefined) ?? undefined,
      customFalDurationParamKey: (config.customFalDurationParamKey as string | undefined) || undefined,
      customReplicateModel: (config.customReplicateModel as string | undefined) || undefined,
      customReplicateParams: (config.customReplicateParams as { key: string; value: string }[] | undefined) || undefined,
      customReplicatePrice: (config.customReplicatePrice as number | undefined) ?? undefined,
      customReplicateCostPerSecond: (config.customReplicateCostPerSecond as number | undefined) ?? undefined,
      customReplicateDurationParamKey: (config.customReplicateDurationParamKey as string | undefined) || undefined,
      customApiUrl: (config.customApiUrl as string | undefined) || undefined,
      customApiMethod: (config.customApiMethod as string | undefined) || undefined,
      customApiHeaders: (config.customApiHeaders as { key: string; value: string }[] | undefined) || undefined,
      customApiParams: (config.customApiParams as { key: string; value: string }[] | undefined) || undefined,
      customApiResultFields: (config.customApiResultFields as { key: string; type: string }[] | undefined) || undefined,
      customApiPrice: (config.customApiPrice as number | undefined) ?? undefined,
      fileBindings: (config.fileBindings as string[] | undefined) || undefined,
      logicMode: (config.logicMode as string | undefined) || undefined,
      logicCondition: (config.logicCondition as any) || undefined,
      utilityConfig: (config.utilityConfig as any) || undefined,
    };
  });

  const sortedSteps = [...stepDefs].sort((a, b) => a.order - b.order);
  const inputs = execution.inputs as { text: string; files: FileInput[] };
  const initialInput = { text: inputs.text || "", files: inputs.files || [] };

  const perStepInputMap: Record<string, { text: string; files: FileInput[] }> = {};
  const customParamMap: Record<string, string> = {};

  // Rebuild input step mappings
  const inputSteps = sortedSteps.filter((s) => s.stepType === "INPUT");
  inputSteps.forEach((step, idx) => {
    const n = idx + 1;
    const accepts = step.acceptTypes || ["text"];
    const stepData = { text: initialInput.text, files: initialInput.files };
    for (const type of accepts) {
      const key = `input_${n}_${type}`;
      if (type === "text") {
        customParamMap[key] = stepData.text;
      } else {
        const file = stepData.files.find((f) => f.type === type);
        customParamMap[key] = file?.url || "";
      }
    }
  });

  const edgeList = (workflow.edges as { source: string; target: string; sourceHandle?: string; targetHandle?: string }[] | null) || [];

  const functionTimeout = parseInt(process.env.FUNCTION_TIMEOUT_SECONDS || "300", 10);
  const deadline = Date.now() + (functionTimeout - 30) * 1000;

  let failed = false;
  let deadlineSaved = false;
  const allResults: (StepResult & { _nextInput?: { text: string; files: FileInput[] } })[] = [];

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    prisma.execution.update({
      where: { id: executionId },
      data: { lastHeartbeat: new Date() },
    }).catch(() => {});
  }, 10_000);

  try {
    const graphResults = await executeWorkflowGraph(
      stepDefs,
      edgeList,
      initialInput,
      perStepInputMap,
      customParamMap,
      {
        onStepComplete: (result, nextInput) => {
          allResults.push({ ...result, _nextInput: nextInput });
          prisma.execution.update({
            where: { id: executionId },
            data: {
              stepResults: allResults.map((r) => ({ ...r })) as any,
              lastHeartbeat: new Date(),
            },
          }).catch(() => {});
        },
        onStepError: (result) => {
          allResults.push(result);
          failed = true;
          prisma.execution.update({
            where: { id: executionId },
            data: {
              stepResults: allResults.map((r) => ({ ...r })) as any,
              lastHeartbeat: new Date(),
            },
          }).catch(() => {});
        },
        onHeartbeat: async () => {
          await prisma.execution.update({
            where: { id: executionId },
            data: { lastHeartbeat: new Date() },
          }).catch(() => {});
        },
        onDeadlineSaveState: async (state: ResumeState) => {
          deadlineSaved = true;
          console.log(`[continue] Saving resume state for execution ${executionId}`);
          await prisma.execution.update({
            where: { id: executionId },
            data: {
              resumeState: state as any,
              stepResults: allResults.map((r) => ({ ...r })) as any,
              lastHeartbeat: new Date(),
            },
          }).catch(() => {});
        },
      },
      deadline,
      resumeState,
    );

    if (!deadlineSaved) {
      const previousResults = (execution.stepResults as any[]) || [];
      const mergedResults = [...previousResults, ...allResults.map((r) => ({ ...r }))];

      const actualBaseCost = mergedResults.reduce((sum: number, r: any) => sum + (r.actualCost || 0), 0);
      const finalCost = actualBaseCost > 0
        ? Math.max(workflow.priceInNolinks, actualBaseCost)
        : cost;

      if (!isAnonymous && execution.userId && finalCost > 0 && !failed) {
        await deductCredits(execution.userId, workflow.id, finalCost, actualBaseCost || baseCost);
      }

      if (isAnonymous && !failed) {
        await prisma.workflow.update({
          where: { id: workflow.id },
          data: { totalUses: { increment: 1 } },
        });
      }

      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: failed ? "FAILED" : "COMPLETED",
          outputs: graphResults[graphResults.length - 1]
            ? { final: graphResults[graphResults.length - 1].output }
            : undefined,
          stepResults: mergedResults as any,
          creditsUsed: isAnonymous ? 0 : (failed ? 0 : finalCost),
          errorMessage: failed ? graphResults[graphResults.length - 1]?.output : undefined,
          completedAt: new Date(),
          resumeState: Prisma.DbNull,
        },
      });
    }
  } catch (err) {
    console.error(`[continue] Execution error:`, err);
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        completedAt: new Date(),
      },
    }).catch(() => {});
  } finally {
    clearInterval(heartbeatInterval);
  }
}
