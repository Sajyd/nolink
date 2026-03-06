import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import {
  type StepDefinition,
  type StepCustomParam,
  type FileInput,
  type StepResult,
} from "@/lib/ai-engine";
import { executeWorkflowGraph } from "@/lib/graph-executor";
import { deductCredits, checkBalance } from "@/lib/credits";
import { estimateWorkflowCost, hasPerSecondPricingSteps } from "@/lib/ai-engine";
import { notifyWorkflowUsed, notifyExecutionCompleted, notifyExecutionFailed } from "@/lib/notifications";

export const config = {
  maxDuration: 800,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { id } = req.query;
  const { input, files, inputs, params: userParams } = req.body;

  const hasLegacyInput = input || (files && files.length > 0);
  const hasPerStepInputs = inputs && typeof inputs === "object" && Object.keys(inputs).length > 0;

  if (!hasLegacyInput && !hasPerStepInputs) {
    return res.status(400).json({ error: "Input is required" });
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: id as string },
    include: {
      steps: { orderBy: { order: "asc" } },
      creator: { select: { subscription: true } },
    },
  });

  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const hasCustomApiStep = workflow.steps.some((s: any) => s.stepType === "CUSTOM_API");
  if (hasCustomApiStep && workflow.creator.subscription !== "ENTERPRISE") {
    return res.status(403).json({
      error: "This workflow uses Custom API nodes which require the creator to have an Enterprise subscription.",
    });
  }

  const baseCost = estimateWorkflowCost(workflow.steps as unknown as StepDefinition[]);
  const cost = Math.max(workflow.priceInNolinks, baseCost);

  const canAfford = await checkBalance(session.user.id, cost);
  if (!canAfford) {
    return res
      .status(402)
      .json({ error: "Insufficient Nolinks balance", required: cost });
  }

  const fileInputs: FileInput[] = (files || []).map((f: any) => ({
    url: f.url,
    type: f.type,
    name: f.name,
    mimeType: f.mimeType,
  }));

  const execution = await prisma.execution.create({
    data: {
      workflowId: workflow.id,
      userId: session.user.id,
      status: "RUNNING",
      inputs: {
        text: input || "",
        files: fileInputs.map((f) => ({ ...f })),
      } as any,
      creditsUsed: cost,
    },
  });

  res.status(202).json({
    jobId: execution.id,
    status: "RUNNING",
    workflowId: workflow.id,
    workflowName: workflow.name,
    creditsReserved: cost,
  });

  runWorkflowInBackground(
    execution.id,
    workflow,
    fileInputs,
    input || "",
    session.user.id,
    cost,
    userParams || {},
    inputs || {}
  ).catch(() => {});
}

async function runWorkflowInBackground(
  executionId: string,
  workflow: any,
  fileInputs: FileInput[],
  input: string,
  userId: string,
  cost: number,
  userParams: Record<string, unknown>,
  rawInputs: Record<string, { text?: string; files?: any[] }>
) {
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
      systemPrompt: s.systemPrompt || "",
      params: s.params as Record<string, unknown> | null,
      acceptTypes: s.acceptTypes,
      customParams: stepCustomParams,
      customFalEndpoint:
        (config.customFalEndpoint as string | undefined) || undefined,
      customFalParams:
        (config.customFalParams as { key: string; value: string }[] | undefined) || undefined,
      customFalPrice:
        (config.customFalPrice as number | undefined) ?? undefined,
      customFalCostPerSecond:
        (config.customFalCostPerSecond as number | undefined) ?? undefined,
      customFalDurationParamKey:
        (config.customFalDurationParamKey as string | undefined) || undefined,
      customReplicateModel:
        (config.customReplicateModel as string | undefined) || undefined,
      customReplicateParams:
        (config.customReplicateParams as { key: string; value: string }[] | undefined) || undefined,
      customReplicatePrice:
        (config.customReplicatePrice as number | undefined) ?? undefined,
      customReplicateCostPerSecond:
        (config.customReplicateCostPerSecond as number | undefined) ?? undefined,
      customReplicateDurationParamKey:
        (config.customReplicateDurationParamKey as string | undefined) || undefined,
      customApiUrl:
        (config.customApiUrl as string | undefined) || undefined,
      customApiMethod:
        (config.customApiMethod as string | undefined) || undefined,
      customApiHeaders:
        (config.customApiHeaders as { key: string; value: string }[] | undefined) || undefined,
      customApiParams:
        (config.customApiParams as { key: string; value: string }[] | undefined) || undefined,
      customApiResultFields:
        (config.customApiResultFields as { key: string; type: string }[] | undefined) || undefined,
      customApiPrice:
        (config.customApiPrice as number | undefined) ?? undefined,
      fileBindings:
        (config.fileBindings as string[] | undefined) || undefined,
      logicMode:
        (config.logicMode as string | undefined) || undefined,
      logicCondition:
        (config.logicCondition as any) || undefined,
      utilityConfig:
        (config.utilityConfig as any) || undefined,
    };
  });

  const sortedSteps = [...stepDefs].sort((a, b) => a.order - b.order);

  const hasPerStepInputs = rawInputs && typeof rawInputs === "object" && Object.keys(rawInputs).length > 0;
  const perStepInputMap: Record<string, { text: string; files: FileInput[] }> = {};
  if (hasPerStepInputs) {
    for (const [stepId, data] of Object.entries(rawInputs)) {
      perStepInputMap[stepId] = {
        text: data.text || "",
        files: (data.files || []).map((f: any) => ({
          url: f.url,
          type: f.type,
          name: f.name,
          mimeType: f.mimeType,
        })),
      };
    }
  }

  const initialInput = { text: input, files: fileInputs };
  let failed = false;
  const customParamMap: Record<string, string> = {};

  const baseCost = estimateWorkflowCost(workflow.steps as unknown as StepDefinition[]);

  const inputSteps = sortedSteps.filter((s) => s.stepType === "INPUT");
  inputSteps.forEach((step, idx) => {
    const n = idx + 1;
    const accepts = step.acceptTypes || ["text"];
    const stepData = perStepInputMap[step.id] || { text: input || "", files: fileInputs };
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

  for (const [key, val] of Object.entries(userParams)) {
    customParamMap[key] = String(val ?? "");
  }

  const edgeList = (workflow.edges as { source: string; target: string; sourceHandle?: string; targetHandle?: string }[] | null) || [];

  const functionTimeout = parseInt(process.env.FUNCTION_TIMEOUT_SECONDS || "300", 10);
  const deadline = Date.now() + (functionTimeout - 30) * 1000;

  const allResults = await executeWorkflowGraph(
    stepDefs,
    edgeList,
    initialInput,
    perStepInputMap,
    customParamMap,
    {
      onIntermediateResult: async (results) => {
        await prisma.execution.update({
          where: { id: executionId },
          data: { stepResults: results as any },
        });
      },
      onStepError: () => {
        failed = true;
      },
    },
    deadline,
  );

  const actualBaseCost = allResults.reduce((sum: number, r: StepResult) => sum + (r.actualCost || 0), 0);
  const finalCost = actualBaseCost > 0
    ? Math.max(workflow.priceInNolinks, actualBaseCost)
    : cost;

  try {
    if (finalCost > 0 && !failed) {
      await deductCredits(userId, workflow.id, finalCost, actualBaseCost || baseCost);
    }

    if (!failed) {
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { totalUses: { increment: 1 } },
      });
    }

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: failed ? "FAILED" : "COMPLETED",
        outputs: allResults[allResults.length - 1]
          ? { final: allResults[allResults.length - 1].output }
          : undefined,
        stepResults: allResults as any,
        creditsUsed: failed ? 0 : finalCost,
        errorMessage: failed ? allResults[allResults.length - 1]?.output : undefined,
        completedAt: new Date(),
      },
    });

    const isOwnWorkflow = userId === workflow.creatorId;
    if (!isOwnWorkflow) {
      notifyWorkflowUsed(workflow.creatorId, workflow.name, workflow.id, 0).catch(() => {});
    }
    if (failed) {
      notifyExecutionFailed(userId, workflow.name, workflow.slug).catch(() => {});
    } else {
      notifyExecutionCompleted(userId, workflow.name, workflow.slug, finalCost).catch(() => {});
    }
  } catch {}
}
