import { useWorkflowStore, type StepNodeData, type StepNodeType } from "@/lib/workflow-store";
import { v4 as uuid } from "uuid";
import type { Node } from "@xyflow/react";
import { estimateCostFromModels } from "@/lib/models";
import { playAddNode } from "@/lib/sounds";
import {
  Upload,
  Download,
  Cpu,
  Sparkles,
  Globe,
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
      aiModel: "gpt-4o",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "Process the following input: {{input}}",
    },
  },
  {
    type: "falAiNode",
    rfType: "falAiNode",
    label: "fal.ai Node",
    icon: Sparkles,
    color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
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

  const addNode = (templateIdx: number) => {
    const template = NODE_TEMPLATES[templateIdx];
    const order = store.nodes.length + 1;
    const xOffset = (order - 1) * 300;

    const newNode: Node<StepNodeData> = {
      id: uuid(),
      type: template.rfType,
      position: { x: xOffset, y: 100 },
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

  const modelIds = store.nodes
    .filter((n) => n.data.aiModel)
    .map((n) => n.data.aiModel);
  const customApiCost = store.nodes
    .filter((n) => n.type === "customApiNode")
    .reduce((sum, n) => sum + (n.data.customApiPrice ?? 0), 0);
  const estimatedCost = estimateCostFromModels(modelIds) + customApiCost;

  return (
    <div className="w-72 h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-y-auto">
      {/* Mobile close button */}
      {onClose && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 md:hidden">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Toolbar</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Node type picker */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Add Node
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
                <p className="text-sm font-semibold">{tmpl.label}</p>
                <p className="text-[10px] opacity-70 leading-tight mt-0.5">
                  {tmpl.description}
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
            Workflow Settings
          </span>
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showSettings && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={store.workflowName}
                onChange={(e) => store.setWorkflowName(e.target.value)}
                className="input-field text-sm"
                placeholder="Untitled Workflow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={store.workflowDescription}
                onChange={(e) => store.setWorkflowDescription(e.target.value)}
                className="input-field text-sm"
                rows={3}
                placeholder="What does this workflow do?"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Price (Nolinks)</label>
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
                  Min. price: {estimatedCost || 1} NL (AI model costs)
                </p>
                {Math.max(store.workflowPrice, estimatedCost || 1) > (estimatedCost || 1) && (
                  <p className="text-[10px] text-emerald-500">
                    You earn: {Math.max(store.workflowPrice, estimatedCost || 1) - (estimatedCost || 1)} NL per run
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
                  <><Eye className="w-3 h-3" /> Public</>
                ) : (
                  <><EyeOff className="w-3 h-3" /> Private</>
                )}
              </span>
            </label>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Examples</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Example Input</label>
                  <textarea
                    value={store.exampleInput}
                    onChange={(e) => store.setExampleInput(e.target.value)}
                    className="input-field text-xs"
                    rows={2}
                    placeholder="e.g. Write a poem about the ocean"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Example Output</label>
                  <textarea
                    value={store.exampleOutput}
                    onChange={(e) => store.setExampleOutput(e.target.value)}
                    className="input-field text-xs"
                    rows={2}
                    placeholder="e.g. The waves crash gently..."
                  />
                  <p className="mt-1 text-[10px] text-gray-400">
                    For media, paste a URL. Shown to users before they run the workflow.
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
          Nodes ({store.nodes.length})
        </h4>
        <div className="space-y-1.5">
          {store.nodes
            .sort((a, b) => a.data.order - b.data.order)
            .map((node) => {
              const typeLabel =
                node.type === "inputNode" ? "IN" :
                node.type === "outputNode" ? "OUT" :
                node.type === "falAiNode" ? "FAL" :
                node.type === "customApiNode" ? "API" : "AI";
              const typeColor =
                node.type === "inputNode" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                node.type === "outputNode" ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" :
                node.type === "falAiNode" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                node.type === "customApiNode" ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" :
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
                  <span className="truncate">{node.data.label || "Untitled"}</span>
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
          {saving ? "Saving..." : store.editingWorkflowId ? "Update Workflow" : "Save Workflow"}
        </button>
        {workflowId && (
          <Link
            href={`/workflow/${workflowId}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit Workflow
          </Link>
        )}
      </div>
    </div>
  );
}
