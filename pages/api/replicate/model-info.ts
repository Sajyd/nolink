import type { NextApiRequest, NextApiResponse } from "next";
import { REPLICATE_USD_TO_NL } from "@/lib/constants";

interface ReplicateParam {
  key: string;
  type: string;
  description: string;
  default?: string;
  required: boolean;
  enumValues?: string[];
}

function resolveRef(root: any, ref: string): any {
  const parts = ref.replace("#/", "").split("/");
  let node = root;
  for (const p of parts) node = node?.[p];
  return node;
}

function resolveSchema(root: any, schema: any): any {
  if (!schema) return schema;
  if (schema.$ref) return resolveSchema(root, resolveRef(root, schema.$ref));
  if (schema.allOf) {
    return schema.allOf.reduce(
      (acc: any, s: any) => ({ ...acc, ...resolveSchema(root, s) }),
      {}
    );
  }
  return schema;
}

function extractInputParams(openapi: any): ReplicateParam[] {
  if (!openapi) return [];

  try {
    const inputSchema =
      openapi.components?.schemas?.Input || openapi.components?.schemas?.input;
    if (!inputSchema) return [];

    const resolved = resolveSchema(openapi, inputSchema);
    const properties = resolved?.properties;
    if (!properties) return [];

    const requiredSet = new Set<string>(resolved.required || []);
    const params: ReplicateParam[] = [];

    for (const [key, raw] of Object.entries<any>(properties)) {
      const prop = resolveSchema(openapi, raw);
      const paramType = prop.type || "string";
      const enumValues = prop.enum as string[] | undefined;
      let defaultVal: string | undefined;
      if (prop.default !== undefined) {
        defaultVal = String(prop.default);
      }

      params.push({
        key,
        type: paramType,
        description: prop.description || prop.title || "",
        default: defaultVal,
        required: requiredSet.has(key),
        ...(enumValues && { enumValues }),
      });
    }

    return params;
  } catch {
    return [];
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { model_id } = req.query;
  if (!model_id || typeof model_id !== "string") {
    return res.status(400).json({ error: "model_id is required (owner/name)" });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token)
    return res.status(500).json({ error: "REPLICATE_API_TOKEN not configured" });

  try {
    const modelRes = await fetch(
      `https://api.replicate.com/v1/models/${model_id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!modelRes.ok) {
      const err = await modelRes.text();
      return res
        .status(modelRes.status)
        .json({ error: `Failed to fetch model: ${err}` });
    }

    const model = await modelRes.json();

    const latestVersion = model.latest_version;
    const openapi = latestVersion?.openapi_schema;
    const params = extractInputParams(openapi);

    let unitPriceUsd = 0;
    let unit = "prediction";
    const hardware = latestVersion?.cog_version
      ? "gpu"
      : "cpu";

    if (model.pricing) {
      if (model.pricing.predict) {
        unitPriceUsd = model.pricing.predict;
        unit = "prediction";
      } else if (model.pricing.train) {
        unitPriceUsd = model.pricing.train;
        unit = "training";
      }
    }

    const costPerUse = unitPriceUsd > 0
      ? Math.max(1, Math.ceil(unitPriceUsd * REPLICATE_USD_TO_NL))
      : 5;

    return res.json({
      modelId: model_id,
      name: model.name || model_id,
      owner: model.owner?.username || model_id.split("/")[0],
      description: model.description || "",
      coverImageUrl: model.cover_image_url || "",
      visibility: model.visibility,
      runCount: model.run_count || 0,
      hardware,
      costPerUse,
      unitPriceUsd,
      unit,
      params,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
