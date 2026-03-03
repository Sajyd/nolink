import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { type StepDefinition, type StepCustomParam, type FileInput, type StepResult } from "@/lib/ai-engine";
import { executeWorkflowGraph, type ResumeState } from "@/lib/graph-executor";
import { deductCredits } from "@/lib/credits";
import { estimateWorkflowCost } from "@/lib/ai-engine";
import { EXECUTION_TIMEOUT_MS, FUNCTION_MAX_DURATION_S, DEADLINE_BUFFER_S } from "@/lib/constants";

export const config = {
  maxDuration: 300,
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

  if (execution.userId && session?.user?.id !== execution.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (execution.workflowId !== id) {
    return res.status(400).json({ error: "Execution does not belong to this workflow" });
  }

  if (execution.status === "COMPLETED" || execution.status === "FAILED") {
    return res.status(400).json({ error: "Execution already finished", status: execution.status });
  }

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

  await prisma.execution.update({
    where: { id: executionId },
    data: { status: "RUNNING", lastHeartbeat: new Date(), resumeState: Prisma.DbNull },
  });

  res.status(202).json({
    jobId: executionId,
    status: "RUNNING",
  });

  runContinuationInBackground(execution, session).catch(() => {});
}

async function runContinuationInBackground(execution: any, session: any) {
  const executionId = execution.id;
  const workflow = execution.workflow;
  const isAnonymous = !execution.userId;
  const baseCost = estimateWorkflowCost(workflow.steps as unknown as StepDefinition[]);
  const cost = Math.max(workflow.priceInNolinks, baseCost);

  let resumeState = execution.resumeState as ResumeState | null;
  if (!resumeState) {
    const stepResults = (execution.stepResults as any[]) || [];
    if (stepResults.length > 0) {
      const completedStepIds = stepResults.map((r: any) => r.stepId);
      const stepOutputs: Record<string, { text: string; files: FileInput[] }> = {};
      for (const r of stepResults) {
        stepOutputs[r.stepId] = {
          text: r._nextInput?.text || r.output || "",
          files: r._nextInput?.files || [],
        };
      }
      resumeState = { completedStepIds, stepOutputs };
    } else {
      resumeState = { completedStepIds: [], stepOutputs: {} };
    }
  }

  const stepDefs: StepDefinition[] = workflow.steps.map((s: any) => {
    const config = (s.config as Record<string, unknown>) || {};
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
      customParams: (config.customParams as StepCustomParam[] | undefined) || undefined,
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
  const inputs = execution.inputs as unknown as { text: string; files: FileInput[] };
  const initialInput = { text: inputs.text || "", files: inputs.files || [] };

  const perStepInputMap: Record<string, { text: string; files: FileInput[] }> = {};
  const customParamMap: Record<string, string> = {};

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
        const file = stepData.files.find((f: FileInput) => f.type === type);
        customParamMap[key] = file?.url || "";
      }
    }
  });

  const edgeList = (workflow.edges as { source: string; target: string; sourceHandle?: string; targetHandle?: string }[] | null) || [];

  const deadline = Date.now() + (FUNCTION_MAX_DURATION_S - DEADLINE_BUFFER_S) * 1000;

  let failed = false;
  let deadlineSaved = false;
  const allResults: (StepResult & { _nextInput?: { text: string; files: FileInput[] } })[] = [];

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
            stepResults: [...((execution.stepResults as any[]) || []), ...allResults.map((r) => ({ ...r }))] as any,
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
            stepResults: [...((execution.stepResults as any[]) || []), ...allResults.map((r) => ({ ...r }))] as any,
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
        const previousResults = (execution.stepResults as any[]) || [];
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            resumeState: state as any,
            stepResults: [...previousResults, ...allResults.map((r) => ({ ...r }))] as any,
            lastHeartbeat: new Date(),
          },
        });
      },
    },
    deadline,
    resumeState,
  );

  if (deadlineSaved) return;

  try {
    if (!isAnonymous && execution.userId && cost > 0 && !failed) {
      await deductCredits(execution.userId, workflow.id, cost, baseCost);
    }

    if (!failed) {
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { totalUses: { increment: 1 } },
      });
    }

    const previousResults = (execution.stepResults as any[]) || [];
    const mergedResults = [...previousResults, ...allResults.map((r) => ({ ...r }))];

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: failed ? "FAILED" : "COMPLETED",
        outputs: graphResults[graphResults.length - 1]
          ? { final: graphResults[graphResults.length - 1].output }
          : undefined,
        stepResults: mergedResults as any,
        errorMessage: failed ? graphResults[graphResults.length - 1]?.output : undefined,
        completedAt: new Date(),
        resumeState: Prisma.DbNull,
      },
    });
  } catch {}
}
