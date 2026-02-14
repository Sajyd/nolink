/**
 * POST /api/ai/generate-service — Génère description + tags depuis une URL (partenaire).
 * Body: { url: string }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateDescriptionAndTags } from "@/lib/ai";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!checkRateLimit(req)) return res.status(429).json({ error: "Too many requests" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const url = (req.body?.url as string)?.trim();
  if (!url) return res.status(400).json({ error: "url requis" });

  const { description, tags } = await generateDescriptionAndTags(url);
  return res.status(200).json({ description, tags });
}
