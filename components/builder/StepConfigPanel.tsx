import { useWorkflowStore } from "@/lib/workflow-store";
import {
  ALL_MODELS,
  getModelById,
  getBasicModels,
  getFalModels,
  getModelsByCategory,
  INPUT_ACCEPT_TYPES,
  type ModelParam,
  type ModelCategory,
} from "@/lib/models";
import { X, Sparkles, Settings2, Upload, Download } from "lucide-react";

const IO_TYPES = ["TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT"];

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
          {(nodeType === "basicNode" || nodeType === "stepNode") && <Settings2 className="w-4 h-4 text-brand-500" />}
          Configure {nodeType === "inputNode" ? "Input" : nodeType === "outputNode" ? "Output" : nodeType === "falAiNode" ? "fal.ai Node" : "Step"}
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
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                fal.ai Model
              </label>
              <select
                value={data.aiModel}
                onChange={(e) => {
                  updateNodeData(selectedNodeId, {
                    aiModel: e.target.value,
                    modelParams: {},
                    paramBindings: {},
                  });
                }}
                className="input-field text-sm"
              >
                <option value="">Select fal.ai model...</option>
                <optgroup label="Image Generation">
                  {getFalModels().filter((m) => m.category === "image").map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
                  ))}
                </optgroup>
                <optgroup label="Video Generation">
                  {getFalModels().filter((m) => m.category === "video").map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
                  ))}
                </optgroup>
                <optgroup label="Audio Generation">
                  {getFalModels().filter((m) => m.category === "audio").map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.costPerUse} NL)</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {data.aiModel && (() => {
              const model = getModelById(data.aiModel);
              if (!model) return null;
              return (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400">{model.description}</p>
                  {model.falEndpoint && (
                    <p className="text-[10px] font-mono text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                      {model.falEndpoint}
                    </p>
                  )}
                </div>
              );
            })()}

            {data.aiModel && <ModelParamsEditor nodeId={selectedNodeId} data={data} inputBindOptions={inputBindOptions} isFal />}
          </>
        )}
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
