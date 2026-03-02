import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { type StepDefinition, type StepCustomParam, type FileInput, type StepResult } from "@/lib/ai-engine";
import { executeWorkflowGraph } from "@/lib/graph-executor";
import { deductCredits, checkBalance } from "@/lib/credits";
import { estimateWorkflowCost } from "@/lib/ai-engine";
import { getModelById } from "@/lib/models";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  const isAnonymous = !session;
  let trialCookie: string | undefined;

  if (isAnonymous) {
    trialCookie = req.cookies["nolink_trial"];
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

  const sseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };

  if (isAnonymous) {
    sseHeaders["Set-Cookie"] = serialize("nolink_trial", "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  res.writeHead(200, sseHeaders);

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let aborted = false;
  req.on("close", () => { aborted = true; });

  const execution = await prisma.execution.create({
    data: {
      workflowId: workflow.id,
      userId: isAnonymous ? null : session.user.id,
      status: "RUNNING",
      inputs: { text: input || "", files: fileInputs.map((f) => ({ ...f })) } as any,
      creditsUsed: isAnonymous ? 0 : cost,
    },
  });

  const stepDefs: StepDefinition[] = workflow.steps.map((s) => {
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
      customReplicateModel: (config.customReplicateModel as string | undefined) || undefined,
      customReplicateParams: (config.customReplicateParams as { key: string; value: string }[] | undefined) || undefined,
      customReplicatePrice: (config.customReplicatePrice as number | undefined) ?? undefined,
      customApiUrl: (config.customApiUrl as string | undefined) || undefined,
      customApiMethod: (config.customApiMethod as string | undefined) || undefined,
      customApiHeaders: (config.customApiHeaders as { key: string; value: string }[] | undefined) || undefined,
      customApiParams: (config.customApiParams as { key: string; value: string }[] | undefined) || undefined,
      customApiResultFields: (config.customApiResultFields as { key: string; type: string }[] | undefined) || undefined,
      customApiPrice: (config.customApiPrice as number | undefined) ?? undefined,
      fileBindings: (config.fileBindings as string[] | undefined) || undefined,
      logicMode: (config.logicMode as string | undefined) || undefined,
      logicCondition: (config.logicCondition as any) || undefined,
    };
  });

  const sortedSteps = [...stepDefs].sort((a, b) => a.order - b.order);
  const visibleSteps = sortedSteps.filter(
    (s) => s.stepType !== "INPUT" && s.stepType !== "OUTPUT"
  );
  const totalVisible = visibleSteps.length;

  send("workflow_start", {
    executionId: execution.id,
    totalSteps: totalVisible,
    steps: visibleSteps.map((s, i) => ({
      stepId: s.id,
      stepName: s.name,
      stepType: s.stepType,
      outputType: s.outputType,
      aiModel: s.aiModel,
      modelName: s.aiModel ? getModelById(s.aiModel)?.name || s.aiModel : null,
      index: i + 1,
    })),
  });

  const perStepInputMap: Record<string, { text: string; files: FileInput[] }> = {};
  if (hasPerStepInputs) {
    for (const [stepId, data] of Object.entries(inputs as Record<string, { text?: string; files?: any[] }>)) {
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

  const initialInput = { text: input || "", files: fileInputs };
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

  const userParams: Record<string, unknown> = req.body.params || {};
  for (const [key, val] of Object.entries(userParams)) {
    customParamMap[key] = String(val ?? "");
  }

  const edgeList = (workflow.edges as { source: string; target: string; sourceHandle?: string; targetHandle?: string }[] | null) || [];

  const allResults = await executeWorkflowGraph(
    stepDefs,
    edgeList,
    initialInput,
    perStepInputMap,
    customParamMap,
    {
      isAborted: () => aborted,
      onStepStart: (step, idx, total) => {
        send("step_start", {
          stepId: step.id,
          stepName: step.name,
          stepType: step.stepType,
          outputType: step.outputType,
          aiModel: step.aiModel,
          modelName: step.aiModel ? getModelById(step.aiModel)?.name || step.aiModel : null,
          index: idx,
          totalSteps: total,
        });
      },
      onStepComplete: (result, _nextInput, idx, total) => {
        send("step_complete", { ...result, index: idx, totalSteps: total });
      },
      onStepError: (result, idx, total) => {
        send("step_error", { ...result, index: idx, totalSteps: total });
        failed = true;
      },
    },
  );

  if (!aborted) {
    try {
      if (!isAnonymous && cost > 0 && !failed) {
        await deductCredits(session.user.id, workflow.id, cost, baseCost);
      }

      if (isAnonymous && !failed) {
        await prisma.workflow.update({
          where: { id: workflow.id },
          data: { totalUses: { increment: 1 } },
        });
      }

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: failed ? "FAILED" : "COMPLETED",
          outputs: allResults[allResults.length - 1]
            ? { final: allResults[allResults.length - 1].output }
            : undefined,
          stepResults: allResults as any,
          completedAt: new Date(),
        },
      });
    } catch {}

    send("workflow_complete", {
      creditsUsed: isAnonymous ? 0 : (failed ? 0 : cost),
      status: failed ? "FAILED" : "COMPLETED",
      isTrialRun: isAnonymous,
    });
  }

  res.end();
}
