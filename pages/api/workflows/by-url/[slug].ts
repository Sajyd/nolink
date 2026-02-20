import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const slug = req.query.slug as string;
  if (!slug) return res.status(400).end();
  const workflow = await prisma.workflow.findUnique({
    where: { publicUrl: slug },
    include: {
      creator: { select: { name: true, image: true } },
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });
  return res.json(workflow);
}
