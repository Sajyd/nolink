import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import {
  executeStep,
  type StepDefinition,
  type StepCustomParam,
  type FileInput,
  type StepResult,
} from "@/lib/ai-engine";
import { deductCredits, checkBalance } from "@/lib/credits";
import { estimateWorkflowCost } from "@/lib/ai-engine";
import { getModelById } from "@/lib/models";

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
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

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

  // Fire-and-forget: run steps in background after response is sent
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
      customParams:
        (config.customParams as StepCustomParam[] | undefined) || undefined,
      customFalEndpoint:
        (config.customFalEndpoint as string | undefined) || undefined,
      customFalParams:
        (config.customFalParams as { key: string; value: string }[] | undefined) || undefined,
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
    };
  });

  const sortedSteps = [...stepDefs].sort((a, b) => a.order - b.order);

  // Build per-step input map
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

  let currentInput: { text: string; files: FileInput[] } = {
    text: input,
    files: fileInputs,
  };
  const allResults: StepResult[] = [];
  let failed = false;
  const customParamMap: Record<string, string> = {};

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

  // Inject user-provided input parameters
  for (const [key, val] of Object.entries(userParams)) {
    customParamMap[key] = String(val ?? "");
  }

  // Build parent map from edges so we can merge outputs from all parents
  const edgeList = (workflow.edges as { source: string; target: string }[] | null) || [];
  const parentMap: Record<string, string[]> = {};
  for (const e of edgeList) {
    if (!parentMap[e.target]) parentMap[e.target] = [];
    parentMap[e.target].push(e.source);
  }
  const stepOutputMap: Record<string, { text: string; files: FileInput[] }> = {};

  const resolveCP = (text: string) =>
    text.replace(/\{\{([^}]+)\}\}/g, (m, name) =>
      name === "input"
        ? m
        : customParamMap[name] !== undefined
          ? customParamMap[name]
          : m
    );

  for (const step of sortedSteps) {
    if (step.stepType === "INPUT" && perStepInputMap[step.id]) {
      currentInput = perStepInputMap[step.id];
    }

    // Merge outputs from all parent steps into currentInput
    const parents = parentMap[step.id];
    if (parents && parents.length > 0) {
      const parentOutputs = parents.map((pid) => stepOutputMap[pid]).filter(Boolean);
      if (parentOutputs.length > 0) {
        const mergedText = parentOutputs.map((o) => o.text).filter(Boolean).join("\n\n");
        const mergedFiles = parentOutputs.flatMap((o) => o.files || []);
        currentInput = { text: mergedText || currentInput.text, files: [...mergedFiles, ...currentInput.files] };
        // Deduplicate files by url
        const seen = new Set<string>();
        currentInput.files = currentInput.files.filter((f) => {
          if (seen.has(f.url)) return false;
          seen.add(f.url);
          return true;
        });
      }
    }

    if (step.customParams) {
      for (const cp of step.customParams) {
        if (cp.name) customParamMap[cp.name] = cp.value;
      }
    }

    const resolvedStep = { ...step };
    if (resolvedStep.prompt) resolvedStep.prompt = resolveCP(resolvedStep.prompt);
    if (resolvedStep.systemPrompt) resolvedStep.systemPrompt = resolveCP(resolvedStep.systemPrompt);
    if (resolvedStep.params) {
      resolvedStep.params = { ...resolvedStep.params };
      for (const [k, v] of Object.entries(resolvedStep.params)) {
        if (typeof v === "string") {
          (resolvedStep.params as Record<string, unknown>)[k] = resolveCP(v);
        }
        if (Array.isArray(v)) {
          (resolvedStep.params as Record<string, unknown>)[k] = v.map((item) =>
            typeof item === "string" ? resolveCP(item) : item
          );
        }
      }
    }
    if (resolvedStep.customApiUrl) {
      resolvedStep.customApiUrl = resolveCP(resolvedStep.customApiUrl);
    }
    if (resolvedStep.customApiParams) {
      resolvedStep.customApiParams = resolvedStep.customApiParams.map((p) => ({
        key: p.key,
        value: resolveCP(p.value),
      }));
    }
    if (resolvedStep.customApiHeaders) {
      resolvedStep.customApiHeaders = resolvedStep.customApiHeaders.map((h) => ({
        key: h.key,
        value: resolveCP(h.value),
      }));
    }
    if (resolvedStep.customFalParams) {
      resolvedStep.customFalParams = resolvedStep.customFalParams.map((p) => ({
        key: p.key,
        value: resolveCP(p.value),
      }));
    }

    // Resolve fileBindings → inject as files into currentInput
    if (resolvedStep.fileBindings && resolvedStep.fileBindings.length > 0) {
      const extraFiles: FileInput[] = [];
      for (const binding of resolvedStep.fileBindings) {
        const url = customParamMap[binding];
        if (!url) continue;
        const parts = binding.split("_");
        const fileType = parts[parts.length - 1] || "document";
        extraFiles.push({ url, type: fileType, name: binding });
      }
      if (extraFiles.length > 0) {
        currentInput = {
          ...currentInput,
          files: [...currentInput.files, ...extraFiles],
        };
      }
    }

    try {
      const result = await executeStep(resolvedStep, currentInput);
      const { _nextInput, ...stepResult } = result;
      allResults.push(stepResult);
      currentInput = _nextInput;

      // Store per-step outputs so downstream steps can reference them
      stepOutputMap[step.id] = _nextInput;
      customParamMap[`step_${step.id}_output`] = _nextInput.text;
      for (const f of _nextInput.files) {
        const key = `step_${step.id}_${f.type}`;
        if (!customParamMap[key]) customParamMap[key] = f.url;
      }

      // Persist intermediate progress
      await prisma.execution.update({
        where: { id: executionId },
        data: { stepResults: allResults as any },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      allResults.push({
        stepId: step.id,
        stepName: step.name,
        stepType: step.stepType,
        output: `Error: ${errMsg}`,
        outputType: step.outputType,
        duration: 0,
      });
      failed = true;
      break;
    }
  }

  try {
    if (cost > 0 && !failed) {
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
        outputs: allResults[allResults.length - 1]
          ? { final: allResults[allResults.length - 1].output }
          : undefined,
        stepResults: allResults as any,
        errorMessage: failed ? allResults[allResults.length - 1]?.output : undefined,
        completedAt: new Date(),
      },
    });
  } catch {}
}
