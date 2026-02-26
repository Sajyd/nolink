import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "@/lib/prisma";
import { WORKFLOW_LIMITS } from "@/lib/constants";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Math.random().toString(36).substring(2, 8)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { category, search, free, sort } = req.query;

    const where: Record<string, unknown> = { isPublic: true };
    if (category && category !== "ALL") where.category = category;
    if (free === "true") where.priceInNolinks = 0;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, string> =
      sort === "popular"
        ? { totalUses: "desc" }
        : sort === "price"
          ? { priceInNolinks: "asc" }
          : { createdAt: "desc" };

    const workflows = await prisma.workflow.findMany({
      where: where as any,
      include: {
        creator: { select: { name: true, image: true } },
        steps: { select: { id: true } },
      },
      orderBy,
      take: 50,
    });

    return res.json(workflows);
  }

  if (req.method === "POST") {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { name, description, category, priceInNolinks, isPublic, steps, exampleInput, exampleOutput } = req.body;

    if (!steps || steps.length === 0) {
      return res.status(400).json({ error: "At least one step is required" });
    }

    if (session.user.subscription === "FREE") {
      return res.status(403).json({
        error: "A paid subscription is required to create workflows. Please upgrade your plan.",
      });
    }

    const existingCount = await prisma.workflow.count({
      where: { creatorId: session.user.id },
    });
    const limit = WORKFLOW_LIMITS[session.user.subscription] || 3;
    if (existingCount >= limit) {
      return res.status(403).json({
        error: `Workflow limit reached (${limit}). Upgrade your plan to create more.`,
      });
    }

    const workflowName = name || "Untitled Workflow";

    const workflow = await prisma.workflow.create({
      data: {
        name: workflowName,
        description: description || "",
        category: category || "OTHER",
        priceInNolinks: priceInNolinks || 0,
        isPublic: isPublic ?? true,
        slug: slugify(workflowName),
        creatorId: session.user.id,
        exampleInput: exampleInput || null,
        exampleOutput: exampleOutput || null,
        steps: {
          create: steps.map((step: any) => {
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
          }),
        },
      },
      include: { steps: true },
    });

    return res.status(201).json(workflow);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
