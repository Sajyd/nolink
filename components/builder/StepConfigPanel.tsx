import {
  useWorkflowStore,
  type CustomParam,
  type CustomFalParam,
  type CustomApiParam,
  type CustomApiResultField,
  type CustomApiResultType,
} from "@/lib/workflow-store";
import {
  ALL_MODELS,
  getModelById,
  getBasicModels,
  getFalModels,
  getCustomFalModel,
  getModelsByCategory,
  INPUT_ACCEPT_TYPES,
  type ModelParam,
  type ModelCategory,
} from "@/lib/models";
import { useSession } from "next-auth/react";
import {
  X, Sparkles, Settings2, Upload, Download, Plus, Trash2, Variable,
  Lock, Clock, Zap, Link2, Globe, Shield, AlertTriangle,
} from "lucide-react";

const IO_TYPES = ["TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT"];

function groupFalVideoModels() {
  const video = getFalModels().filter((m) => m.category === "video");
  const seedance = video.filter((m) => m.id.includes("seedance"));
  const kling3 = video.filter((m) => m.id.includes("kling-v3"));
  const klingO3 = video.filter((m) => m.id.includes("kling-o3"));
  const kling25 = video.filter((m) => m.id.includes("kling-2.5"));
  const kling16 = video.filter((m) => m.id.includes("kling-1.6"));
  const sora = video.filter((m) => m.id.includes("sora"));
  const usedIds = new Set([...seedance, ...kling3, ...klingO3, ...kling25, ...kling16, ...sora].map((m) => m.id));
  const other = video.filter((m) => !usedIds.has(m.id));
  return { seedance, kling3, klingO3, kling25, kling16, sora, other };
}

export default function StepConfigPanel() {
  const { nodes, selectedNodeId, updateNodeData, setSelectedNodeId } =
    useWorkflowStore();

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node || !selectedNodeId) return null;

  const data = node.data;
  const nodeType = node.type || "basicNode";

  const inputNodes = nodes.filter((n) => n.type === "inputNode");
  const inputBindOptions = inputNodes.flatMap((n, idx) => {
    const accepts = n.data.acceptTypes || ["text"];
    return accepts.map((type, ti) => ({
      value: `input_${idx + 1}_${type}`,
      label: `Input ${idx + 1}: ${type}`,
    }));
  });

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          {nodeType === "inputNode" && <Upload className="w-4 h-4 text-emerald-500" />}
          {nodeType === "outputNode" && <Download className="w-4 h-4 text-violet-500" />}
          {nodeType === "falAiNode" && <Sparkles className="w-4 h-4 text-amber-500" />}
          {nodeType === "customApiNode" && <Globe className="w-4 h-4 text-rose-500" />}
          {(nodeType === "basicNode" || nodeType === "stepNode") && <Settings2 className="w-4 h-4 text-brand-500" />}
          Configure {
            nodeType === "inputNode" ? "Input" :
            nodeType === "outputNode" ? "Output" :
            nodeType === "falAiNode" ? "fal.ai Node" :
            nodeType === "customApiNode" ? "Custom API" :
            "Step"
          }
        </h3>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Node Name — all types */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={data.label}
            onChange={(e) => updateNodeData(selectedNodeId, { label: e.target.value })}
            className="input-field text-sm"
            placeholder={nodeType === "inputNode" ? "User Input" : nodeType === "outputNode" ? "Final Output" : "Step name..."}
          />
        </div>

        {/* ── INPUT NODE CONFIG ──────────────────────────── */}
        {nodeType === "inputNode" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Accepted Input Types
            </label>
            <div className="space-y-1.5">
              {INPUT_ACCEPT_TYPES.map((t) => {
                const accepts = data.acceptTypes || ["text"];
                const checked = accepts.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? accepts.filter((a) => a !== t.id)
                          : [...accepts, t.id];
                        updateNodeData(selectedNodeId, {
                          acceptTypes: next.length > 0 ? next : ["text"],
                        });
                      }}
                      className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[10px] text-gray-400">{t.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── OUTPUT NODE CONFIG ─────────────────────────── */}
        {nodeType === "outputNode" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Output Format
            </label>
            <select
              value={data.outputType}
              onChange={(e) => updateNodeData(selectedNodeId, { outputType: e.target.value })}
              className="input-field text-sm"
            >
              {IO_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-400">
              The final result format delivered to the user
            </p>
          </div>
        )}

        {/* ── BASIC NODE CONFIG ──────────────────────────── */}
        {(nodeType === "basicNode" || nodeType === "stepNode") && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Input Type
                </label>
                <select
                  value={data.inputType}
                  onChange={(e) => updateNodeData(selectedNodeId, { inputType: e.target.value })}
                  className="input-field text-sm"
                >
                  {IO_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Output Type
                </label>
                <select
                  value={data.outputType}
                  onChange={(e) => updateNodeData(selectedNodeId, { outputType: e.target.value, aiModel: "" })}
                  className="input-field text-sm"
                >
                  {IO_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                AI Model
              </label>
              <select
                value={data.aiModel}
                onChange={(e) => updateNodeData(selectedNodeId, { aiModel: e.target.value })}
                className="input-field text-sm"
              >
                <option value="">Select model...</option>
                {getBasicModels().map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.category} ({m.costPerUse} NL)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Prompt / Template
              </label>
              <textarea
                value={data.prompt}
                onChange={(e) => updateNodeData(selectedNodeId, { prompt: e.target.value })}
                rows={4}
                className="input-field text-sm font-mono"
                placeholder="Use {{input}} for the step input..."
              />
            </div>

            {/* Model-specific params */}
            {data.aiModel && <ModelParamsEditor nodeId={selectedNodeId} data={data} inputBindOptions={inputBindOptions} />}
          </>
        )}

        {/* ── FAL.AI NODE CONFIG ─────────────────────────── */}
        {nodeType === "falAiNode" && (
          <FalAiNodeConfig
            nodeId={selectedNodeId}
            data={data}
            inputBindOptions={inputBindOptions}
          />
        )}

        {/* ── CUSTOM API NODE CONFIG ──────────────────────── */}
        {nodeType === "customApiNode" && (
          <CustomApiNodeConfig
            nodeId={selectedNodeId}
            data={data}
            inputBindOptions={inputBindOptions}
          />
        )}

        {/* ── RETURN PARAMETERS (all node types) ─────────── */}
        <CustomParamsEditor nodeId={selectedNodeId} data={data} allNodes={nodes} />
      </div>
    </div>
  );
}

function ModelParamsEditor({
  nodeId,
  data,
  inputBindOptions,
  isFal,
}: {
  nodeId: string;
  data: any;
  inputBindOptions: { value: string; label: string }[];
  isFal?: boolean;
}) {
  const { updateNodeData } = useWorkflowStore();
  const model = getModelById(data.aiModel);
  if (!model) return null;

  const params = model.params;
  const values = data.modelParams || {};
  const bindings = data.paramBindings || {};

  const setParam = (key: string, value: unknown) => {
    updateNodeData(nodeId, {
      modelParams: { ...values, [key]: value },
    });
  };

  const setBinding = (key: string, binding: string) => {
    updateNodeData(nodeId, {
      paramBindings: { ...bindings, [key]: binding },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500">
          {isFal ? "fal.ai" : "Model"} Parameters
        </h4>
        <span className="text-[10px] text-gray-400">{params.length} params</span>
      </div>

      {params.map((param, idx) => {
        const binding = bindings[param.key];
        const isBound = binding && binding !== "manual";

        return (
          <div key={param.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {param.label}
                {param.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {param.bindable && (
                <select
                  value={binding || "manual"}
                  onChange={(e) => setBinding(param.key, e.target.value)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-transparent"
                >
                  <option value="manual">Manual</option>
                  <option value="{{input}}">Previous step</option>
                  {inputBindOptions.map((opt) => (
                    <option key={opt.value} value={`{{${opt.value}}}`}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {param.description && (
              <p className="text-[10px] text-gray-400">{param.description}</p>
            )}

            {isBound ? (
              <div className="px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-mono">
                Bound to: {binding}
              </div>
            ) : (
              <ParamInput
                param={param}
                value={values[param.key] ?? param.default ?? ""}
                onChange={(v) => setParam(param.key, v)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ParamInput({
  param,
  value,
  onChange,
}: {
  param: ModelParam;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (param.type) {
    case "textarea":
      return (
        <textarea
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="input-field text-xs font-mono"
          placeholder={`Enter ${param.label.toLowerCase()}...`}
        />
      );
    case "select":
      return (
        <select
          value={String(value || param.default || "")}
          onChange={(e) => onChange(e.target.value)}
          className="input-field text-sm"
        >
          {param.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "number":
      return (
        <input
          type="number"
          value={value as number ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          min={param.min}
          max={param.max}
          step={param.max && param.max <= 2 ? 0.1 : 1}
          className="input-field text-sm"
        />
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-300 text-brand-500"
          />
          <span className="text-xs text-gray-500">{value ? "Enabled" : "Disabled"}</span>
        </label>
      );
    default:
      return (
        <input
          type="text"
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          className="input-field text-sm"
          placeholder={`Enter ${param.label.toLowerCase()}...`}
        />
      );
  }
}

function CustomParamsEditor({
  nodeId,
  data,
  allNodes,
}: {
  nodeId: string;
  data: any;
  allNodes: any[];
}) {
  const { updateNodeData } = useWorkflowStore();
  const customParams: CustomParam[] = data.customParams || [];

  const addParam = () => {
    updateNodeData(nodeId, {
      customParams: [...customParams, { name: "", value: "" }],
    });
  };

  const updateParam = (index: number, field: "name" | "value", val: string) => {
    const next = customParams.map((p, i) =>
      i === index ? { ...p, [field]: val } : p
    );
    updateNodeData(nodeId, { customParams: next });
  };

  const removeParam = (index: number) => {
    updateNodeData(nodeId, {
      customParams: customParams.filter((_, i) => i !== index),
    });
  };

  const otherParams = allNodes
    .filter((n) => n.id !== nodeId && (n.data.customParams?.length ?? 0) > 0)
    .flatMap((n) =>
      (n.data.customParams as CustomParam[])
        .filter((p) => p.name)
        .map((p) => ({ node: n.data.label || "Unnamed", name: p.name }))
    );

  return (
    <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Variable className="w-3.5 h-3.5" />
          Return Parameters
        </h4>
        <button
          onClick={addParam}
          className="flex items-center gap-1 text-[10px] font-medium text-brand-500 hover:text-brand-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {customParams.length === 0 ? (
        <p className="text-[10px] text-gray-400">
          No return parameters. Add one to make it available as{" "}
          <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">
            {"{{name}}"}
          </code>{" "}
          in linked nodes.
        </p>
      ) : (
        <div className="space-y-2">
          {customParams.map((param, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={param.name}
                  onChange={(e) =>
                    updateParam(idx, "name", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                  }
                  className="input-field text-xs font-mono"
                  placeholder="param_name"
                />
                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => updateParam(idx, "value", e.target.value)}
                  className="input-field text-xs"
                  placeholder="Parameter value..."
                />
              </div>
              <button
                onClick={() => removeParam(idx)}
                className="mt-1 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {otherParams.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-gray-400">
            Available from other nodes:
          </p>
          <div className="flex flex-wrap gap-1">
            {otherParams.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-mono"
                title={`From: ${p.node}`}
              >
                {`{{${p.name}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {customParams.length > 0 && (
        <p className="text-[10px] text-gray-400">
          Use{" "}
          <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">
            {"{{param_name}}"}
          </code>{" "}
          in prompts of downstream nodes to reference these values.
        </p>
      )}
    </div>
  );
}

// ─── Fal.ai Node Config (grouped models + custom) ──────────────

function FalAiNodeConfig({
  nodeId,
  data,
  inputBindOptions,
}: {
  nodeId: string;
  data: any;
  inputBindOptions: { value: string; label: string }[];
}) {
  const { data: session } = useSession();
  const { updateNodeData } = useWorkflowStore();
  const isPro = session?.user?.subscription === "PRO" || session?.user?.subscription === "ENTERPRISE";
  const customFalModel = getCustomFalModel();
  const groups = groupFalVideoModels();
  const isCustomModel = data.aiModel === "fal-custom";
  const selectedModel = data.aiModel ? getModelById(data.aiModel) : null;

  const handleModelChange = (value: string) => {
    const reset: Partial<any> = {
      aiModel: value,
      modelParams: {},
      paramBindings: {},
    };
    if (value !== "fal-custom") {
      reset.customFalEndpoint = "";
      reset.customFalParams = [];
    }
    updateNodeData(nodeId, reset);
  };

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          fal.ai Model
        </label>
        <select
          value={data.aiModel}
          onChange={(e) => handleModelChange(e.target.value)}
          className="input-field text-sm"
        >
          <option value="">Select fal.ai model...</option>

          <optgroup label="Image Generation">
            {getFalModels().filter((m) => m.category === "image").map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
            ))}
          </optgroup>

          <optgroup label="Seedance (ByteDance)">
            {groups.seedance.map((m) => (
              <option key={m.id} value={m.id} disabled={m.comingSoon}>
                {m.name} {m.comingSoon ? "— Coming Soon" : `(${m.costPerUse} NL)`}
              </option>
            ))}
          </optgroup>

          <optgroup label="Kling 3 / V3 (Kuaishou)">
            {groups.kling3.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
            ))}
          </optgroup>

          <optgroup label="Kling O3 Omni (Kuaishou)">
            {groups.klingO3.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
            ))}
          </optgroup>

          <optgroup label="Kling 2.5 Turbo (Kuaishou)">
            {groups.kling25.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
            ))}
          </optgroup>

          <optgroup label="Sora 2 (OpenAI)">
            {groups.sora.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
            ))}
          </optgroup>

          {(groups.kling16.length > 0 || groups.other.length > 0) && (
            <optgroup label="Other Video">
              {groups.kling16.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
              ))}
              {groups.other.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
              ))}
            </optgroup>
          )}

          <optgroup label="Audio Generation">
            {getFalModels().filter((m) => m.category === "audio").map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
            ))}
          </optgroup>

          <optgroup label="Custom Model (Pro)">
            <option value="fal-custom" disabled={!isPro}>
              {customFalModel.name} {!isPro ? "— Upgrade to Pro" : ""}
            </option>
          </optgroup>
        </select>
      </div>

      {/* Model info badge */}
      {selectedModel && !isCustomModel && (
        <div className="space-y-1">
          {selectedModel.comingSoon && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Coming Soon — Available Feb 24, 2026
              </span>
            </div>
          )}
          <p className="text-[10px] text-gray-400">{selectedModel.description}</p>
          {selectedModel.falEndpoint && (
            <p className="text-[10px] font-mono text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
              {selectedModel.falEndpoint}
            </p>
          )}
        </div>
      )}

      {/* Standard model params (non-custom) */}
      {data.aiModel && !isCustomModel && !selectedModel?.comingSoon && (
        <ModelParamsEditor nodeId={nodeId} data={data} inputBindOptions={inputBindOptions} isFal />
      )}

      {/* Custom fal.ai model UI */}
      {isCustomModel && (
        <CustomFalModelEditor nodeId={nodeId} data={data} inputBindOptions={inputBindOptions} />
      )}
    </>
  );
}

// ─── Custom fal.ai Model Editor ─────────────────────────────────

// ─── Custom API Node Config ─────────────────────────────────────

const RESULT_TYPES: { value: CustomApiResultType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image URL" },
  { value: "video", label: "Video URL" },
  { value: "audio", label: "Audio URL" },
  { value: "document", label: "Document URL" },
  { value: "url", label: "Link / URL" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function CustomApiNodeConfig({
  nodeId,
  data,
  inputBindOptions,
}: {
  nodeId: string;
  data: any;
  inputBindOptions: { value: string; label: string }[];
}) {
  const { data: session } = useSession();
  const { updateNodeData } = useWorkflowStore();
  const isPro = session?.user?.subscription === "PRO" || session?.user?.subscription === "ENTERPRISE";
  const apiParams: CustomApiParam[] = data.customApiParams || [];
  const apiHeaders: CustomApiParam[] = data.customApiHeaders || [];
  const resultFields: CustomApiResultField[] = data.customApiResultFields || [];

  if (!isPro) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
          <Lock className="w-4 h-4 text-rose-500" />
          <div>
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Pro Feature</p>
            <p className="text-[10px] text-rose-500/80">
              Upgrade to Pro to connect custom APIs to your workflows.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const addParam = () =>
    updateNodeData(nodeId, { customApiParams: [...apiParams, { key: "", value: "" }] });
  const updateParam = (idx: number, field: "key" | "value", val: string) =>
    updateNodeData(nodeId, {
      customApiParams: apiParams.map((p, i) => (i === idx ? { ...p, [field]: val } : p)),
    });
  const removeParam = (idx: number) =>
    updateNodeData(nodeId, { customApiParams: apiParams.filter((_, i) => i !== idx) });

  const addHeader = () =>
    updateNodeData(nodeId, { customApiHeaders: [...apiHeaders, { key: "", value: "" }] });
  const updateHeader = (idx: number, field: "key" | "value", val: string) =>
    updateNodeData(nodeId, {
      customApiHeaders: apiHeaders.map((p, i) => (i === idx ? { ...p, [field]: val } : p)),
    });
  const removeHeader = (idx: number) =>
    updateNodeData(nodeId, { customApiHeaders: apiHeaders.filter((_, i) => i !== idx) });

  const addResult = () =>
    updateNodeData(nodeId, {
      customApiResultFields: [...resultFields, { key: "", type: "text" as CustomApiResultType }],
    });
  const updateResult = (idx: number, field: "key" | "type", val: string) =>
    updateNodeData(nodeId, {
      customApiResultFields: resultFields.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    });
  const removeResult = (idx: number) =>
    updateNodeData(nodeId, { customApiResultFields: resultFields.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            Third-party API — Use at your own risk
          </p>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 leading-tight mt-0.5">
            This API is not verified or endorsed by Nolink. It may process data
            externally. Do not send sensitive information unless you trust the provider.
            Nolink is not responsible for third-party API behavior.
          </p>
        </div>
      </div>

      {/* Pro badge */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
        <Globe className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
          Pro Feature — Custom API Connection
        </span>
      </div>

      {/* URL + Method */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          API URL
        </label>
        <div className="flex gap-1.5">
          <select
            value={data.customApiMethod || "POST"}
            onChange={(e) => updateNodeData(nodeId, { customApiMethod: e.target.value as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" })}
            className="input-field text-xs font-mono w-[80px] shrink-0"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            type="text"
            value={data.customApiUrl || ""}
            onChange={(e) => updateNodeData(nodeId, { customApiUrl: e.target.value })}
            className="input-field text-xs font-mono flex-1"
            placeholder="https://api.example.com/v1/generate"
          />
        </div>
        <p className="text-[10px] text-gray-400">
          The full URL of the API endpoint. Must be HTTPS.
        </p>
      </div>

      {/* Step Price */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Step Price (Nolinks)
        </label>
        <div className="relative">
          <input
            type="number"
            min={0}
            value={data.customApiPrice ?? 0}
            onChange={(e) => updateNodeData(nodeId, { customApiPrice: parseInt(e.target.value) || 0 })}
            className="input-field text-sm pl-8"
          />
          <Zap className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-500" />
        </div>
        <p className="mt-1 text-[10px] text-gray-400">
          Nolinks charged to the user per call to this API step.
        </p>
      </div>

      {/* Headers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Headers
          </h4>
          <button
            onClick={addHeader}
            className="flex items-center gap-1 text-[10px] font-medium text-brand-500 hover:text-brand-600"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        {apiHeaders.length === 0 ? (
          <p className="text-[10px] text-gray-400">
            Add request headers (e.g. Authorization, Content-Type).
          </p>
        ) : (
          <div className="space-y-1.5">
            {apiHeaders.map((h, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => updateHeader(idx, "key", e.target.value)}
                  className="input-field text-xs font-mono flex-1"
                  placeholder="Header-Name"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(idx, "value", e.target.value)}
                  className="input-field text-xs flex-1"
                  placeholder="value"
                />
                <button
                  onClick={() => removeHeader(idx)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body / Query Params */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Parameters
          </h4>
          <button
            onClick={addParam}
            className="flex items-center gap-1 text-[10px] font-medium text-brand-500 hover:text-brand-600"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        {apiParams.length === 0 ? (
          <p className="text-[10px] text-gray-400">
            Add key-value parameters. Use{" "}
            <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">
              {"{{input}}"}
            </code>{" "}
            to bind to the previous step&apos;s output.
          </p>
        ) : (
          <div className="space-y-2">
            {apiParams.map((param, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => updateParam(idx, "key", e.target.value)}
                    className="input-field text-xs font-mono flex-1"
                    placeholder="param_name"
                  />
                  <button
                    onClick={() => removeParam(idx)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => updateParam(idx, "value", e.target.value)}
                    className="input-field text-xs flex-1"
                    placeholder="value or {{input}} / {{variable}}"
                  />
                  <select
                    value={
                      param.value.startsWith("{{") && param.value.endsWith("}}")
                        ? param.value
                        : "_manual_"
                    }
                    onChange={(e) => {
                      if (e.target.value === "_manual_") return;
                      updateParam(idx, "value", e.target.value);
                    }}
                    className="text-[10px] px-1.5 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent w-24 shrink-0"
                  >
                    <option value="_manual_">Manual</option>
                    <option value="{{input}}">Prev. step</option>
                    {inputBindOptions.map((opt) => (
                      <option key={opt.value} value={`{{${opt.value}}}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {param.value.startsWith("{{") && param.value.endsWith("}}") && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-500">
                    <Link2 className="w-2.5 h-2.5" />
                    <span className="font-mono">Bound to {param.value}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Result Fields
          </h4>
          <button
            onClick={addResult}
            className="flex items-center gap-1 text-[10px] font-medium text-brand-500 hover:text-brand-600"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        <p className="text-[10px] text-gray-400">
          Specify which fields from the API JSON response to extract and their types.
        </p>
        {resultFields.length === 0 ? (
          <p className="text-[10px] text-gray-400 italic">
            No result fields. The raw response will be passed as text.
          </p>
        ) : (
          <div className="space-y-1.5">
            {resultFields.map((rf, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={rf.key}
                  onChange={(e) => updateResult(idx, "key", e.target.value)}
                  className="input-field text-xs font-mono flex-1"
                  placeholder="response.data.url"
                />
                <select
                  value={rf.type}
                  onChange={(e) => updateResult(idx, "type", e.target.value)}
                  className="input-field text-xs w-28 shrink-0"
                >
                  {RESULT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeResult(idx)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomFalModelEditor({
  nodeId,
  data,
  inputBindOptions,
}: {
  nodeId: string;
  data: any;
  inputBindOptions: { value: string; label: string }[];
}) {
  const { updateNodeData } = useWorkflowStore();
  const customFalParams: CustomFalParam[] = data.customFalParams || [];
  const endpoint = data.customFalEndpoint || "";

  const setEndpoint = (value: string) => {
    updateNodeData(nodeId, { customFalEndpoint: value });
  };

  const addParam = () => {
    updateNodeData(nodeId, {
      customFalParams: [...customFalParams, { key: "", value: "" }],
    });
  };

  const updateParam = (index: number, field: "key" | "value", val: string) => {
    const next = customFalParams.map((p, i) =>
      i === index ? { ...p, [field]: val } : p
    );
    updateNodeData(nodeId, { customFalParams: next });
  };

  const removeParam = (index: number) => {
    updateNodeData(nodeId, {
      customFalParams: customFalParams.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
        <Zap className="w-3.5 h-3.5 text-purple-500" />
        <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
          Pro Feature — Custom fal.ai Endpoint
        </span>
      </div>

      {/* Endpoint input */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          fal.ai Endpoint
        </label>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          className="input-field text-xs font-mono"
          placeholder="fal-ai/my-model/v1/text-to-video"
        />
        <p className="mt-1 text-[10px] text-gray-400">
          The fal.ai model ID or workflow endpoint (e.g. <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">fal-ai/model-name</code>)
        </p>
      </div>

      {/* Custom parameters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">
            API Parameters
          </h4>
          <button
            onClick={addParam}
            className="flex items-center gap-1 text-[10px] font-medium text-brand-500 hover:text-brand-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Param
          </button>
        </div>

        {customFalParams.length === 0 ? (
          <p className="text-[10px] text-gray-400">
            No parameters yet. Add key-value pairs to send to the fal.ai API.
            Use{" "}
            <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">
              {"{{input}}"}
            </code>{" "}
            to bind to the previous step&apos;s output.
          </p>
        ) : (
          <div className="space-y-2">
            {customFalParams.map((param, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) =>
                      updateParam(idx, "key", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                    }
                    className="input-field text-xs font-mono flex-1"
                    placeholder="param_name"
                  />
                  <button
                    onClick={() => removeParam(idx)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => updateParam(idx, "value", e.target.value)}
                    className="input-field text-xs flex-1"
                    placeholder="value or {{input}} / {{variable}}"
                  />
                  <select
                    value={
                      param.value.startsWith("{{") && param.value.endsWith("}}")
                        ? param.value
                        : "_manual_"
                    }
                    onChange={(e) => {
                      if (e.target.value === "_manual_") return;
                      updateParam(idx, "value", e.target.value);
                    }}
                    className="text-[10px] px-1.5 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent w-24 shrink-0"
                  >
                    <option value="_manual_">Manual</option>
                    <option value="{{input}}">Prev. step</option>
                    {inputBindOptions.map((opt) => (
                      <option key={opt.value} value={`{{${opt.value}}}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {param.value.startsWith("{{") && param.value.endsWith("}}") && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-500">
                    <Link2 className="w-2.5 h-2.5" />
                    <span className="font-mono">Bound to {param.value}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
