import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { estimateWorkflowCost, type StepDefinition } from "@/lib/ai-engine";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).end();

  /* ─── GET ─── fetch workflow (public or own private) ──────────── */
  if (req.method === "GET") {
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, image: true } },
        steps: { orderBy: { order: "asc" } },
        _count: { select: { executions: true } },
      },
    });

    if (!workflow) {
      const byUrl = await prisma.workflow.findUnique({
        where: { publicUrl: id },
        include: {
          creator: { select: { id: true, name: true, image: true } },
          steps: { orderBy: { order: "asc" } },
          _count: { select: { executions: true } },
        },
      });
      if (byUrl) {
        if (!byUrl.isPublic) {
          const session = await getServerSession(req, res, authOptions);
          if (!session || session.user.id !== byUrl.creator.id) {
            return res.status(403).json({ error: "This workflow is private" });
          }
        }
        return res.json(byUrl);
      }
      return res.status(404).json({ error: "Workflow not found" });
    }

    if (!workflow.isPublic) {
      const session = await getServerSession(req, res, authOptions);
      if (!session || session.user.id !== workflow.creator.id) {
        return res.status(403).json({ error: "This workflow is private" });
      }
    }

    return res.json(workflow);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  /* ─── PUT ─── full update (metadata + steps) ──────────────────── */
  if (req.method === "PUT") {
    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow || workflow.creatorId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name, description, category, priceInNolinks, isPublic, exampleInput, exampleOutput, steps } = req.body;

    if (steps && Array.isArray(steps)) {
      const stepsData = steps.map((step: any) => {
        const config: Record<string, unknown> = { ...(step.config || {}) };
        if (step.customParams) config.customParams = step.customParams;
        if (step.customFalEndpoint) config.customFalEndpoint = step.customFalEndpoint;
        if (step.customFalParams) config.customFalParams = step.customFalParams;
        if (step.customApiUrl) config.customApiUrl = step.customApiUrl;
        if (step.customApiMethod) config.customApiMethod = step.customApiMethod;
        if (step.customApiHeaders) config.customApiHeaders = step.customApiHeaders;
        if (step.customApiParams) config.customApiParams = step.customApiParams;
        if (step.customApiResultFields) config.customApiResultFields = step.customApiResultFields;
        if (step.customApiPrice != null) config.customApiPrice = step.customApiPrice;
        if (step.fileBindings && step.fileBindings.length > 0) config.fileBindings = step.fileBindings;
        if (step.inputParameters && step.inputParameters.length > 0) config.inputParameters = step.inputParameters;
        return {
          order: step.order,
          name: step.name || `Step ${step.order}`,
          stepType: step.stepType || "BASIC",
          aiModel: step.aiModel || null,
          inputType: step.inputType || "TEXT",
          outputType: step.outputType || "TEXT",
          prompt: step.prompt || "",
          config: Object.keys(config).length > 0 ? config : undefined,
          params: step.modelParams || undefined,
          acceptTypes: step.acceptTypes || [],
          positionX: step.positionX || 0,
          positionY: step.positionY || 0,
        };
      });

      const minCost = estimateWorkflowCost(steps as StepDefinition[]);
      const enforcedPrice = priceInNolinks !== undefined
        ? Math.max(priceInNolinks, minCost)
        : undefined;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.step.deleteMany({ where: { workflowId: id } });
        return tx.workflow.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(category && { category }),
            ...(enforcedPrice !== undefined && { priceInNolinks: enforcedPrice }),
            ...(isPublic !== undefined && { isPublic }),
            ...(exampleInput !== undefined && { exampleInput }),
            ...(exampleOutput !== undefined && { exampleOutput }),
            steps: { create: stepsData },
          },
          include: { steps: true },
        });
      });

      return res.json(updated);
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(priceInNolinks !== undefined && { priceInNolinks }),
        ...(isPublic !== undefined && { isPublic }),
        ...(exampleInput !== undefined && { exampleInput }),
        ...(exampleOutput !== undefined && { exampleOutput }),
      },
    });

    return res.json(updated);
  }

  /* ─── PATCH ─── metadata-only update ──────────────────────────── */
  if (req.method === "PATCH") {
    const w = await prisma.workflow.findFirst({
      where: { id, creatorId: session.user.id },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!w) return res.status(404).json({ error: "Not found" });
    const body = req.body as Partial<{
      name: string;
      description: string;
      category: string;
      priceInNolinks: number;
      isPublic: boolean;
    }>;
    let enforcedPrice: number | undefined;
    if (body.priceInNolinks != null) {
      const minCost = estimateWorkflowCost(w.steps as unknown as StepDefinition[]);
      enforcedPrice = Math.max(body.priceInNolinks, minCost);
    }
    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.description != null && { description: body.description }),
        ...(body.category != null && { category: body.category }),
        ...(enforcedPrice != null && { priceInNolinks: enforcedPrice }),
        ...(body.isPublic != null && { isPublic: body.isPublic }),
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    return res.json(updated);
  }

  /* ─── DELETE ──────────────────────────────────────────────────── */
  if (req.method === "DELETE") {
    const w = await prisma.workflow.findFirst({ where: { id, creatorId: session.user.id } });
    if (!w) return res.status(404).json({ error: "Not found" });
    await prisma.workflow.delete({ where: { id } });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
