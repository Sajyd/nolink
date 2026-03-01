import type { NextApiRequest, NextApiResponse } from "next";
import { FAL_USD_TO_NL } from "@/lib/constants";

interface FalParam {
  key: string;
  type: string;
  description: string;
  default?: string;
  required: boolean;
  enumValues?: string[];
}

function resolveRef(schema: any, ref: string): any {
  const parts = ref.replace("#/", "").split("/");
  let node = schema;
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

function extractParamsFromOpenApi(openapi: any): FalParam[] {
  if (!openapi || openapi.error) return [];

  try {
    const paths = openapi.paths || {};
    const postOp =
      paths["/"]?.post || Object.values(paths)?.[0]?.["post"];
    if (!postOp) return [];

    const bodySchema =
      postOp.requestBody?.content?.["application/json"]?.schema;
    if (!bodySchema) return [];

    const resolved = resolveSchema(openapi, bodySchema);
    const properties = resolved?.properties;
    if (!properties) return [];

    const requiredSet = new Set<string>(resolved.required || []);
    const params: FalParam[] = [];

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

  const { endpoint_id } = req.query;
  if (!endpoint_id || typeof endpoint_id !== "string") {
    return res.status(400).json({ error: "endpoint_id is required" });
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey)
    return res.status(500).json({ error: "FAL_KEY not configured" });

  try {
    const [modelRes, pricingRes] = await Promise.all([
      fetch(
        `https://api.fal.ai/v1/models?endpoint_id=${encodeURIComponent(endpoint_id)}&expand=openapi-3.0`,
        { headers: { Authorization: `Key ${falKey}` } }
      ),
      fetch(
        `https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(endpoint_id)}`,
        { headers: { Authorization: `Key ${falKey}` } }
      ),
    ]);

    if (!modelRes.ok) {
      const err = await modelRes.text();
      return res
        .status(modelRes.status)
        .json({ error: `Failed to fetch model info: ${err}` });
    }

    const modelData = await modelRes.json();
    const model = modelData.models?.[0];
    if (!model)
      return res.status(404).json({ error: "Model not found on fal.ai" });

    let unitPriceUsd = 0;
    let unit = "call";
    if (pricingRes.ok) {
      const pricingData = await pricingRes.json();
      const price = pricingData.prices?.[0];
      if (price) {
        unitPriceUsd = price.unit_price;
        unit = price.unit;
      }
    }

    const costPerUse = Math.max(1, Math.ceil(unitPriceUsd * FAL_USD_TO_NL));
    const params = extractParamsFromOpenApi(model.openapi);

    return res.json({
      endpointId: endpoint_id,
      name: model.metadata?.display_name || endpoint_id,
      category: model.metadata?.category || "unknown",
      description: model.metadata?.description || "",
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
