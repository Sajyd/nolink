import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { executeStep, type StepDefinition, type FileInput, type StepResult } from "@/lib/ai-engine";
import { deductCredits, checkBalance } from "@/lib/credits";
import { estimateWorkflowCost } from "@/lib/ai-engine";
import { getModelById } from "@/lib/models";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.query;
  const { input, files } = req.body;

  if (!input && (!files || files.length === 0)) {
    return res.status(400).json({ error: "Input is required" });
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: id as string },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const cost = workflow.priceInNolinks > 0
    ? workflow.priceInNolinks
    : estimateWorkflowCost(workflow.steps as unknown as StepDefinition[]);

  const canAfford = await checkBalance(session.user.id, cost);
  if (!canAfford) {
    return res.status(402).json({ error: "Insufficient Nolinks balance", required: cost });
  }

  const fileInputs: FileInput[] = (files || []).map((f: any) => ({
    url: f.url,
    type: f.type,
    name: f.name,
    mimeType: f.mimeType,
  }));

  // Set up SSE streaming
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let aborted = false;
  req.on("close", () => { aborted = true; });

  const execution = await prisma.execution.create({
    data: {
      workflowId: workflow.id,
      userId: session.user.id,
      status: "RUNNING",
      inputs: { text: input || "", files: fileInputs.map((f) => ({ ...f })) } as any,
      creditsUsed: cost,
    },
  });

  const stepDefs: StepDefinition[] = workflow.steps.map((s) => ({
    id: s.id,
    order: s.order,
    name: s.name,
    stepType: s.stepType,
    aiModel: s.aiModel,
    inputType: s.inputType,
    outputType: s.outputType,
    prompt: s.prompt,
    params: s.params as Record<string, unknown> | null,
    acceptTypes: s.acceptTypes,
  }));

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

  let currentInput: { text: string; files: FileInput[] } = { text: input || "", files: fileInputs };
  const allResults: StepResult[] = [];
  let visibleIndex = 0;
  let failed = false;

  for (const step of sortedSteps) {
    if (aborted) break;

    const isVisible = step.stepType !== "INPUT" && step.stepType !== "OUTPUT";

    if (isVisible) {
      visibleIndex++;
      send("step_start", {
        stepId: step.id,
        stepName: step.name,
        stepType: step.stepType,
        outputType: step.outputType,
        aiModel: step.aiModel,
        modelName: step.aiModel ? getModelById(step.aiModel)?.name || step.aiModel : null,
        index: visibleIndex,
        totalSteps: totalVisible,
      });
    }

    try {
      const result = await executeStep(step, currentInput);
      const { _nextInput, ...stepResult } = result;
      allResults.push(stepResult);
      currentInput = _nextInput;

      if (isVisible) {
        send("step_complete", {
          ...stepResult,
          index: visibleIndex,
          totalSteps: totalVisible,
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      const stepResult: StepResult = {
        stepId: step.id,
        stepName: step.name,
        stepType: step.stepType,
        output: `Error: ${errMsg}`,
        outputType: step.outputType,
        duration: 0,
      };
      allResults.push(stepResult);

      if (isVisible) {
        send("step_error", {
          ...stepResult,
          index: visibleIndex,
          totalSteps: totalVisible,
        });
      }
      failed = true;
      break;
    }
  }

  if (!aborted) {
    try {
      if (cost > 0 && !failed) {
        await deductCredits(session.user.id, workflow.id, cost);
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
      creditsUsed: failed ? 0 : cost,
      status: failed ? "FAILED" : "COMPLETED",
    });
  }

  res.end();
}
