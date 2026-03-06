import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);

  const { rating, message, page, workflowId } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }
  if (!page) {
    return res.status(400).json({ error: "Page is required" });
  }

  try {
    await prisma.feedback.create({
      data: {
        userId: session?.user?.id ?? null,
        workflowId: workflowId || null,
        page,
        rating: Math.round(rating),
        message: message?.trim() || null,
      },
    });

    return res.status(201).json({ success: true });
  } catch {
    return res.status(500).json({ error: "Failed to save feedback" });
  }
}
