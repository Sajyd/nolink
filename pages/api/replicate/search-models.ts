import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { q } = req.query;
  if (!q || typeof q !== "string" || q.trim().length < 2) {
    return res.json({ models: [] });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token)
    return res.status(500).json({ error: "REPLICATE_API_TOKEN not configured" });

  try {
    const response = await fetch(
      `https://api.replicate.com/v1/models?query=${encodeURIComponent(q.trim())}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const err = await response.text();
      return res
        .status(response.status)
        .json({ error: `Replicate search failed: ${err}` });
    }

    const data = await response.json();
    const models = (data.results || []).map((m: any) => ({
      modelId: `${m.owner}/${m.name}`,
      name: m.name,
      owner: m.owner,
      description: m.description || "",
      coverImageUrl: m.cover_image_url || "",
      visibility: m.visibility,
      runCount: m.run_count || 0,
      latestVersionId: m.latest_version?.id || null,
    }));

    return res.json({ models });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
