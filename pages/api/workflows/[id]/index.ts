import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === "GET") {
    const workflow = await prisma.workflow.findUnique({
      where: { id: id as string },
      include: {
        creator: { select: { id: true, name: true, image: true } },
        steps: { orderBy: { order: "asc" } },
        _count: { select: { executions: true } },
      },
    });

    if (!workflow) return res.status(404).json({ error: "Workflow not found" });

    // Private workflow access control
    if (!workflow.isPublic) {
      const session = await getServerSession(req, res, authOptions);
      if (!session || session.user.id !== workflow.creator.id) {
        return res.status(403).json({ error: "This workflow is private" });
      }
    }

    return res.json(workflow);
  }

  if (req.method === "PUT") {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const workflow = await prisma.workflow.findUnique({
      where: { id: id as string },
    });

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

      const updated = await prisma.$transaction(async (tx) => {
        await tx.step.deleteMany({ where: { workflowId: id as string } });
        return tx.workflow.update({
          where: { id: id as string },
          data: {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(category && { category }),
            ...(priceInNolinks !== undefined && { priceInNolinks }),
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
      where: { id: id as string },
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

  if (req.method === "DELETE") {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const workflow = await prisma.workflow.findUnique({
      where: { id: id as string },
    });

    if (!workflow || workflow.creatorId !== session.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.workflow.delete({ where: { id: id as string } });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
