import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { type StepDefinition, type StepCustomParam, type FileInput, type StepResult } from "@/lib/ai-engine";
import { executeWorkflowGraph, type ResumeState } from "@/lib/graph-executor";
import { deductCredits, checkBalance } from "@/lib/credits";
import { estimateWorkflowCost, hasPerSecondPricingSteps, getStepPricingInfo } from "@/lib/ai-engine";
import { getModelById } from "@/lib/models";
import { serialize } from "cookie";

export const config = {
  maxDuration: 800,
};

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

  const keepAlive = setInterval(() => {
    if (!aborted) res.write(`: keep-alive\n\n`);
  }, 15_000);

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

  // Heartbeat: update DB every 10s so the poll endpoint can detect stalls
  const heartbeatInterval = setInterval(() => {
    prisma.execution.update({
      where: { id: execution.id },
      data: { lastHeartbeat: new Date() },
    }).catch(() => {});
  }, 10_000);

  const stepDefs: StepDefinition[] = workflow.steps.map((s) => {
    const config = (s.config as Record<string, unknown>) || {};

    let stepCustomParams = (config.customParams as StepCustomParam[] | undefined) || undefined;
    if (s.stepType === "INPUT" && stepCustomParams) {
      const inputParamNames = new Set(
        ((config.inputParameters as { name: string }[]) || []).map((p) => p.name).filter(Boolean)
      );
      if (inputParamNames.size > 0) {
        stepCustomParams = stepCustomParams.filter((cp) => !inputParamNames.has(cp.name));
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
  const visibleSteps = sortedSteps.filter(
    (s) => s.stepType !== "INPUT" && s.stepType !== "OUTPUT"
  );
  const totalVisible = visibleSteps.length;

  send("workflow_start", {
    executionId: execution.id,
    totalSteps: totalVisible,
    steps: visibleSteps.map((s, i) => {
      const model = s.aiModel ? getModelById(s.aiModel) : null;
      const dbStep = workflow.steps.find((ws: any) => ws.id === s.id);
      const pricing = dbStep ? getStepPricingInfo(dbStep as any) : null;
      return {
        stepId: s.id,
        stepName: s.name,
        stepType: s.stepType,
        outputType: s.outputType,
        aiModel: s.aiModel,
        modelName: model?.name || s.aiModel,
        index: i + 1,
        costPerSecond: pricing?.costPerSecond || null,
        costPerUse: pricing?.costPerUse || null,
      };
    }),
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
  let deadlineSaved = false;
  const customParamMap: Record<string, string> = {};
  const allResults: (StepResult & { _nextInput?: { text: string; files: FileInput[] } })[] = [];

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

  const functionTimeout = parseInt(process.env.FUNCTION_TIMEOUT_SECONDS || "300", 10);
  const deadline = Date.now() + (functionTimeout - 30) * 1000;

  const graphResults = await executeWorkflowGraph(
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
      onStepComplete: (result, nextInput, idx, total) => {
        send("step_complete", { ...result, index: idx, totalSteps: total });
        allResults.push({ ...result, _nextInput: nextInput });
        // Persist intermediate results to DB for polling fallback
        prisma.execution.update({
          where: { id: execution.id },
          data: {
            stepResults: allResults.map((r) => ({ ...r })) as any,
            lastHeartbeat: new Date(),
          },
        }).catch(() => {});
      },
      onStepError: (result, idx, total) => {
        send("step_error", { ...result, index: idx, totalSteps: total });
        allResults.push(result);
        failed = true;
        prisma.execution.update({
          where: { id: execution.id },
          data: {
            stepResults: allResults.map((r) => ({ ...r })) as any,
            lastHeartbeat: new Date(),
          },
        }).catch(() => {});
      },
      onHeartbeat: async () => {
        await prisma.execution.update({
          where: { id: execution.id },
          data: { lastHeartbeat: new Date() },
        }).catch(() => {});
      },
      onDeadlineSaveState: async (state: ResumeState) => {
        deadlineSaved = true;
        console.log(`[execute] Saving resume state for execution ${execution.id}`);
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            resumeState: state as any,
            stepResults: allResults.map((r) => ({ ...r })) as any,
            lastHeartbeat: new Date(),
          },
        }).catch(() => {});
      },
    },
    deadline,
  );

  clearInterval(heartbeatInterval);

  if (!aborted) {
    if (deadlineSaved) {
      // Execution was paused due to deadline — don't finalize, let continue endpoint resume
      send("workflow_complete", {
        creditsUsed: 0,
        status: "RUNNING",
        isTrialRun: isAnonymous,
        needsContinuation: true,
      });
    } else {
      const actualBaseCost = graphResults.reduce((sum, r) => sum + (r.actualCost || 0), 0);
      const finalCost = actualBaseCost > 0
        ? Math.max(workflow.priceInNolinks, actualBaseCost)
        : cost;

      try {
        if (!isAnonymous && finalCost > 0 && !failed) {
          await deductCredits(session.user.id, workflow.id, finalCost, actualBaseCost || baseCost);
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
            outputs: graphResults[graphResults.length - 1]
              ? { final: graphResults[graphResults.length - 1].output }
              : undefined,
            stepResults: allResults.map((r) => ({ ...r })) as any,
            creditsUsed: isAnonymous ? 0 : (failed ? 0 : finalCost),
            completedAt: new Date(),
            resumeState: Prisma.DbNull,
          },
        });
      } catch {}

      send("workflow_complete", {
        creditsUsed: isAnonymous ? 0 : (failed ? 0 : finalCost),
        status: failed ? "FAILED" : "COMPLETED",
        isTrialRun: isAnonymous,
      });
    }
  }

  clearInterval(keepAlive);
  res.end();
}
