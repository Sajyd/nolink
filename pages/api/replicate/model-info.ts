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
    const { allOf, ...sibling } = schema;
    const merged = allOf.reduce(
      (acc: any, s: any) => ({ ...acc, ...resolveSchema(root, s) }),
      {}
    );
    return { ...merged, ...sibling };
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
      const rawProp = resolveSchema(openapi, raw);

      let prop = rawProp;
      if (prop.anyOf && Array.isArray(prop.anyOf)) {
        const nonNull = prop.anyOf.find((s: any) => s.type !== "null");
        if (nonNull) {
          const { anyOf, ...sibling } = prop;
          prop = { ...resolveSchema(openapi, nonNull), ...sibling };
        }
      }

      const paramType = prop.type || "string";
      const enumValues = prop.enum as string[] | undefined;
      let defaultVal: string | undefined;
      if (prop.default !== undefined && prop.default !== null) {
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

/** Parse "owner/name" or "owner/name:version_id" */
function parseModelId(raw: string): {
  owner: string;
  name: string;
  version: string | null;
} {
  const colonIdx = raw.indexOf(":");
  if (colonIdx !== -1) {
    const base = raw.slice(0, colonIdx);
    const version = raw.slice(colonIdx + 1);
    const [owner, ...rest] = base.split("/");
    return { owner, name: rest.join("/"), version: version || null };
  }
  const [owner, ...rest] = raw.split("/");
  return { owner, name: rest.join("/"), version: null };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { model_id } = req.query;
  if (!model_id || typeof model_id !== "string") {
    return res.status(400).json({ error: "model_id is required (owner/name or owner/name:version)" });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token)
    return res.status(500).json({ error: "REPLICATE_API_TOKEN not configured" });

  try {
    const { owner, name, version: requestedVersion } = parseModelId(model_id);
    const basePath = `${owner}/${name}`;

    const modelRes = await fetch(
      `https://api.replicate.com/v1/models/${basePath}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!modelRes.ok) {
      const err = await modelRes.text();
      return res
        .status(modelRes.status)
        .json({ error: `Failed to fetch model: ${err}` });
    }

    const model = await modelRes.json();

    let versionData = model.latest_version;
    let resolvedVersion = versionData?.id || null;

    if (requestedVersion) {
      const versionRes = await fetch(
        `https://api.replicate.com/v1/models/${basePath}/versions/${requestedVersion}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (versionRes.ok) {
        versionData = await versionRes.json();
        resolvedVersion = requestedVersion;
      } else {
        return res.status(404).json({
          error: `Version ${requestedVersion} not found for ${basePath}`,
        });
      }
    }

    const openapi = versionData?.openapi_schema;
    const params = extractInputParams(openapi);

    let unitPriceUsd = 0;
    let unit = "prediction";

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
      modelId: basePath,
      name: model.name || name,
      owner: model.owner?.username || owner,
      description: model.description || "",
      coverImageUrl: model.cover_image_url || "",
      visibility: model.visibility,
      runCount: model.run_count || 0,
      latestVersionId: model.latest_version?.id || null,
      resolvedVersionId: resolvedVersion,
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
