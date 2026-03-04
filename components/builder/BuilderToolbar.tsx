import { useWorkflowStore, topologicalOrder, type StepNodeData, type StepNodeType } from "@/lib/workflow-store";
import { v4 as uuid } from "uuid";
import type { Node } from "@xyflow/react";
import { getModelById, computeModelCost } from "@/lib/models";
import { playAddNode } from "@/lib/sounds";
import {
  Upload,
  Download,
  Cpu,
  Sparkles,
  Box,
  Globe,
  GitBranch,
  Wrench,
  Save,
  Eye,
  EyeOff,
  Zap,
  Settings,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

const CATEGORIES = [
  "CONTENT", "MARKETING", "DEVELOPMENT", "DESIGN",
  "AUDIO_VIDEO", "DATA", "EDUCATION", "OTHER",
];

const NODE_TEMPLATES: {
  type: StepNodeType;
  rfType: string;
  label: string;
  icon: typeof Cpu;
  color: string;
  description: string;
  defaults: Partial<StepNodeData>;
}[] = [
  {
    type: "inputNode",
    rfType: "inputNode",
    label: "User Input",
    icon: Upload,
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    description: "Accept text, image, video, audio, or documents from the user",
    defaults: {
      label: "User Input",
      stepType: "inputNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
      acceptTypes: ["text"],
    },
  },
  {
    type: "basicNode",
    rfType: "basicNode",
    label: "Basic AI Node",
    icon: Cpu,
    color: "text-brand-500 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800",
    description: "GPT-5.2, Claude Opus, Gemini 3, Grok, LLaMA and more",
    defaults: {
      label: "",
      stepType: "basicNode",
      aiModel: "gpt-5.2",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "{{input}}",
      systemPrompt: "",
    },
  },
  {
    type: "falAiNode",
    rfType: "falAiNode",
    label: "fal.ai Node",
    icon: Sparkles,
    color: "text-pink-500 bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800",
    description: "Nano Banana, Kling, Seedance, Veo 3.1, Stable Audio and more",
    defaults: {
      label: "",
      stepType: "falAiNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "IMAGE",
      prompt: "",
      modelParams: {},
      paramBindings: {},
    },
  },
  {
    type: "replicateNode",
    rfType: "replicateNode",
    label: "Replicate Node",
    icon: Box,
    color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
    description: "FLUX, SDXL, Recraft, Minimax Video, Luma and more",
    defaults: {
      label: "",
      stepType: "replicateNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "IMAGE",
      prompt: "",
      modelParams: {},
      paramBindings: {},
    },
  },
  {
    type: "logicNode",
    rfType: "logicNode",
    label: "Logic Gate",
    icon: GitBranch,
    color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    description: "Route execution with if/else or while loop gates",
    defaults: {
      label: "",
      stepType: "logicNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
      logicMode: "condition",
      logicCondition: {
        leftOperand: "{{input}}",
        operator: "is_not_empty",
        rightOperand: "",
      },
    },
  },
  {
    type: "utilityNode",
    rfType: "utilityNode",
    label: "Utility",
    icon: Wrench,
    color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    description: "Text transforms, loops, media info — no AI cost",
    defaults: {
      label: "",
      stepType: "utilityNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
      utilityConfig: {
        operation: "uppercase",
      },
    },
  },
  {
    type: "customApiNode",
    rfType: "customApiNode",
    label: "Custom API",
    icon: Globe,
    color: "text-rose-500 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
    description: "Connect any external REST API (Pro only)",
    defaults: {
      label: "",
      stepType: "customApiNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
      customApiUrl: "",
      customApiMethod: "POST",
      customApiHeaders: [],
      customApiParams: [],
      customApiResultFields: [],
      customApiPrice: 0,
    },
  },
  {
    type: "outputNode",
    rfType: "outputNode",
    label: "Final Output",
    icon: Download,
    color: "text-violet-500 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
    description: "Deliver the final result to the user",
    defaults: {
      label: "Final Output",
      stepType: "outputNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
    },
  },
];

interface BuilderToolbarProps {
  onSave: () => void;
  saving: boolean;
  workflowId?: string | null;
  onClose?: () => void;
}

export default function BuilderToolbar({ onSave, saving, workflowId, onClose }: BuilderToolbarProps) {
  const store = useWorkflowStore();
  const [showSettings, setShowSettings] = useState(true);
  const { t } = useTranslation();

  const nodeLabels: Record<string, { label: string; desc: string }> = {
    inputNode: { label: t("builder.userInput"), desc: t("builder.userInputDesc") },
    basicNode: { label: t("builder.basicAiNode"), desc: t("builder.basicAiNodeDesc") },
    falAiNode: { label: t("builder.falAiNode"), desc: t("builder.falAiNodeDesc") },
    replicateNode: { label: t("builder.replicateNode"), desc: t("builder.replicateNodeDesc") },
    logicNode: { label: t("builder.logicGate"), desc: t("builder.logicGateDesc") },
    utilityNode: { label: t("builder.utility"), desc: t("builder.utilityDesc") },
    customApiNode: { label: t("builder.customApi"), desc: t("builder.customApiDesc") },
    outputNode: { label: t("builder.finalOutput"), desc: t("builder.finalOutputDesc") },
  };

  const addNode = (templateIdx: number) => {
    const template = NODE_TEMPLATES[templateIdx];
    const order = store.nodes.length + 1;

    let x = 100;
    let y = 100;
    if (store.nodes.length > 0) {
      const rightmost = store.nodes.reduce((best, n) =>
        n.position.x > best.position.x ? n : best
      );
      x = rightmost.position.x + 300;
      y = rightmost.position.y;
    }

    const newNode: Node<StepNodeData> = {
      id: uuid(),
      type: template.rfType,
      position: { x, y },
      data: {
        ...template.defaults,
        label: template.defaults.label || `Step ${order}`,
        order,
      } as StepNodeData,
    };

    store.addNode(newNode);
    playAddNode();
    store.setSelectedNodeId(newNode.id);
    onClose?.();
  };

  const customKvCost = (
    base: number,
    cps: number | undefined,
    dKey: string | undefined,
    kvParams: { key: string; value: string }[] | undefined
  ) => {
    if (!cps || !dKey || !kvParams) return base;
    const entry = kvParams.find((p) => p.key === dKey);
    const sec = entry ? parseFloat(entry.value) : 0;
    return sec > 0 ? Math.max(1, Math.ceil(cps * sec)) : base;
  };

  const estimatedCost = store.nodes.reduce((sum, n) => {
    if (n.type === "customApiNode") return sum + (n.data.customApiPrice ?? 0);
    if (n.data.aiModel === "fal-custom") {
      return sum + customKvCost(
        n.data.customFalPrice ?? 0,
        n.data.customFalCostPerSecond as number | undefined,
        n.data.customFalDurationParamKey as string | undefined,
        n.data.customFalParams as { key: string; value: string }[] | undefined
      );
    }
    if (n.data.aiModel === "rep-custom") {
      return sum + customKvCost(
        n.data.customReplicatePrice ?? 0,
        n.data.customReplicateCostPerSecond as number | undefined,
        n.data.customReplicateDurationParamKey as string | undefined,
        n.data.customReplicateParams as { key: string; value: string }[] | undefined
      );
    }
    if (n.data.aiModel) {
      const m = getModelById(n.data.aiModel as string);
      if (m) return sum + computeModelCost(m, n.data.params as Record<string, unknown> | undefined);
      return sum + 2;
    }
    return sum;
  }, 0);

  return (
    <div className="w-72 h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-y-auto">
      {/* Mobile close button */}
      {onClose && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 md:hidden">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t("builder.toolbar")}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Node type picker */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {t("builder.addNode")}
        </h4>
        <div className="space-y-2">
          {NODE_TEMPLATES.map((tmpl, idx) => (
            <button
              key={tmpl.type}
              onClick={() => addNode(idx)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${tmpl.color}`}
            >
              <tmpl.icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{nodeLabels[tmpl.type]?.label || tmpl.label}</p>
                <p className="text-[10px] opacity-70 leading-tight mt-0.5">
                  {nodeLabels[tmpl.type]?.desc || tmpl.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Workflow settings */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-600 dark:text-gray-300"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t("builder.workflowSettings")}
          </span>
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSettings && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("builder.name")}</label>
              <input
                type="text"
                value={store.workflowName}
                onChange={(e) => store.setWorkflowName(e.target.value)}
                className="input-field text-sm"
                placeholder={t("builder.untitledWorkflow")}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("builder.description")}</label>
              <textarea
                value={store.workflowDescription}
                onChange={(e) => store.setWorkflowDescription(e.target.value)}
                className="input-field text-sm"
                rows={3}
                placeholder={t("builder.whatDoes")}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("builder.category")}</label>
              <select
                value={store.workflowCategory}
                onChange={(e) => store.setWorkflowCategory(e.target.value)}
                className="input-field text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("builder.priceNolinks")}</label>
              <div className="relative">
                <input
                  type="number"
                  min={estimatedCost || 1}
                  value={Math.max(store.workflowPrice, estimatedCost || 1)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    store.setWorkflowPrice(Math.max(val, estimatedCost || 1));
                  }}
                  className="input-field text-sm pl-8"
                />
                <Zap className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-500" />
              </div>
              <div className="mt-1.5 space-y-0.5">
                <p className="text-[10px] text-gray-400">
                  {t("builder.minPrice", { price: String(estimatedCost || 1) })}
                </p>
                {Math.max(store.workflowPrice, estimatedCost || 1) > (estimatedCost || 1) && (
                  <p className="text-[10px] text-emerald-500">
                    {t("builder.youEarn", { amount: String(Math.max(store.workflowPrice, estimatedCost || 1) - (estimatedCost || 1)) })}
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <button
                onClick={() => store.setIsPublic(!store.isPublic)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  store.isPublic ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    store.isPublic ? "translate-x-5" : ""
                  }`}
                />
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                {store.isPublic ? (
                  <><Eye className="w-3 h-3" /> {t("common.public")}</>
                ) : (
                  <><EyeOff className="w-3 h-3" /> {t("common.private")}</>
                )}
              </span>
            </label>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">{t("builder.examples")}</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("builder.exampleInput")}</label>
                  <textarea
                    value={store.exampleInput}
                    onChange={(e) => store.setExampleInput(e.target.value)}
                    className="input-field text-xs"
                    rows={2}
                    placeholder={t("builder.exampleInputPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("builder.exampleOutput")}</label>
                  <textarea
                    value={store.exampleOutput}
                    onChange={(e) => store.setExampleOutput(e.target.value)}
                    className="input-field text-xs"
                    rows={2}
                    placeholder={t("builder.exampleOutputPlaceholder")}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">
                    {t("builder.mediaUrlHint")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Steps list */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex-1">
        <h4 className="text-xs font-medium text-gray-500 mb-2">
          {t("builder.nodes", { count: String(store.nodes.length) })}
        </h4>
        <div className="space-y-1.5">
          {topologicalOrder(store.nodes, store.edges)
            .map((node, topoIdx) => {
              const typeLabel =
                node.type === "inputNode" ? "IN" :
                node.type === "outputNode" ? "OUT" :
                node.type === "falAiNode" ? "FAL" :
                node.type === "replicateNode" ? "REP" :
                node.type === "customApiNode" ? "API" :
                node.type === "logicNode" ? "LOGIC" :
                node.type === "utilityNode" ? "UTIL" : "AI";
              const typeColor =
                node.type === "inputNode" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                node.type === "outputNode" ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" :
                node.type === "falAiNode" ? "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" :
                node.type === "replicateNode" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" :
                node.type === "customApiNode" ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" :
                node.type === "logicNode" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                node.type === "utilityNode" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400";

              return (
                <button
                  key={node.id}
                  onClick={() => store.setSelectedNodeId(node.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    store.selectedNodeId === node.id
                      ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${typeColor}`}>
                    {typeLabel}
                  </span>
                  <span className="truncate">{node.data.label || t("builder.untitled")}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Save button */}
      <div className="p-4 space-y-2">
        <button
          onClick={onSave}
          disabled={saving || store.nodes.length === 0}
          className="btn-primary w-full gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? t("builder.saving") : store.editingWorkflowId ? t("builder.updateWorkflow") : t("builder.saveWorkflow")}
        </button>
        {workflowId && (
          <Link
            href={`/workflow/${workflowId}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t("builder.visitWorkflow")}
          </Link>
        )}
      </div>
    </div>
  );
}
