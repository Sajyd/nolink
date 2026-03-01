import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { q, category } = req.query;
  if (!q || typeof q !== "string" || q.trim().length < 2) {
    return res.json({ models: [] });
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey)
    return res.status(500).json({ error: "FAL_KEY not configured" });

  try {
    const params = new URLSearchParams({
      q: q.trim(),
      status: "active",
      limit: "15",
    });
    if (category && typeof category === "string") {
      params.set("category", category);
    }

    const response = await fetch(
      `https://api.fal.ai/v1/models?${params.toString()}`,
      { headers: { Authorization: `Key ${falKey}` } }
    );

    if (!response.ok) {
      const err = await response.text();
      return res
        .status(response.status)
        .json({ error: `fal.ai search failed: ${err}` });
    }

    const data = await response.json();
    const models = (data.models || []).map((m: any) => ({
      endpointId: m.endpoint_id,
      name: m.metadata?.display_name || m.endpoint_id,
      category: m.metadata?.category || "",
      description: m.metadata?.description || "",
      thumbnail: m.metadata?.thumbnail_url || "",
      tags: m.metadata?.tags || [],
    }));

    return res.json({ models });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
