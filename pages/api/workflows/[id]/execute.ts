import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { type StepDefinition, type StepCustomParam, type FileInput, type StepResult } from "@/lib/ai-engine";
import { executeWorkflowGraph, type ResumeState } from "@/lib/graph-executor";
import { deductCredits, checkBalance } from "@/lib/credits";
import { estimateWorkflowCost } from "@/lib/ai-engine";
import { serialize } from "cookie";
import { FUNCTION_MAX_DURATION_S, DEADLINE_BUFFER_S } from "@/lib/constants";

export const config = {
  maxDuration: 300,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const isAnonymous = !session;

  if (isAnonymous) {
    const trialCookie = req.cookies["nolink_trial"];
    if (trialCookie) {
      return res.status(401).json({
        error: "signup_required",
        message: "Sign up to keep running workflows — your free trial run has been used.",
      });
    }
  }

  const { id } = req.query;
  const { input, files, inputs } = req.body;

  const hasLegacyInput = input || (files && files.length > 0);
  const hasPerStepInputs = inputs && typeof inputs === "object" && Object.keys(inputs).length > 0;

  if (!hasLegacyInput && !hasPerStepInputs) {
    return res.status(400).json({ error: "Input is required" });
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: id as string },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!workflow) return res.status(404).json({ error: "Workflow not found" });
  if (!workflow.isPublic && isAnonymous) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const baseCost = estimateWorkflowCost(workflow.steps as unknown as StepDefinition[]);
  const cost = Math.max(workflow.priceInNolinks, baseCost);

  if (!isAnonymous) {
    const canAfford = await checkBalance(session.user.id, cost);
    if (!canAfford) {
      return res.status(402).json({ error: "Insufficient Nolinks balance", required: cost });
    }
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
      userId: isAnonymous ? null : session.user.id,
      status: "RUNNING",
      inputs: { text: input || "", files: fileInputs.map((f) => ({ ...f })) } as any,
      creditsUsed: isAnonymous ? 0 : cost,
      lastHeartbeat: new Date(),
    },
  });

  if (isAnonymous) {
    res.setHeader(
      "Set-Cookie",
      serialize("nolink_trial", "1", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      })
    );
  }

  res.status(202).json({
    jobId: execution.id,
    status: "RUNNING",
    workflowId: workflow.id,
    workflowName: workflow.name,
    creditsReserved: isAnonymous ? 0 : cost,
    isTrialRun: isAnonymous,
  });

  const userParams: Record<string, unknown> = req.body.params || {};

  runWorkflowInBackground(
    execution.id,
    workflow,
    fileInputs,
    input || "",
    isAnonymous ? null : session.user.id,
    cost,
    isAnonymous,
    userParams,
    inputs || {},
  ).catch(() => {});
}

async function runWorkflowInBackground(
  executionId: string,
  workflow: any,
  fileInputs: FileInput[],
  input: string,
  userId: string | null,
  cost: number,
  isAnonymous: boolean,
  userParams: Record<string, unknown>,
  rawInputs: Record<string, { text?: string; files?: any[] }>,
) {
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
  const allResults: (StepResult & { _nextInput?: { text: string; files: FileInput[] } })[] = [];

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

  const deadline = Date.now() + (FUNCTION_MAX_DURATION_S - DEADLINE_BUFFER_S) * 1000;
  let deadlineSaved = false;

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
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            resumeState: state as any,
            stepResults: allResults.map((r) => ({ ...r })) as any,
            lastHeartbeat: new Date(),
          },
        });
      },
    },
    deadline,
  );

  if (deadlineSaved) return;

  try {
    if (!isAnonymous && userId && cost > 0 && !failed) {
      await deductCredits(userId, workflow.id, cost, baseCost);
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
        outputs: graphResults[graphResults.length - 1]
          ? { final: graphResults[graphResults.length - 1].output }
          : undefined,
        stepResults: allResults.map((r) => ({ ...r })) as any,
        errorMessage: failed ? graphResults[graphResults.length - 1]?.output : undefined,
        completedAt: new Date(),
        resumeState: Prisma.DbNull,
      },
    });
  } catch {}
}
