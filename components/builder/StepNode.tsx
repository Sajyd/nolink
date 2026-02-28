import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Type, Image, Mic, Video, FileText, Cpu, Variable } from "lucide-react";
import { useWorkflowStore, topologicalOrder, type StepNodeData } from "@/lib/workflow-store";
import { getModelById } from "@/lib/models";
import NodeShell from "./NodeShell";

const IO_ICONS: Record<string, typeof Type> = {
  TEXT: Type,
  IMAGE: Image,
  AUDIO: Mic,
  VIDEO: Video,
  DOCUMENT: FileText,
};

const IO_COLORS: Record<string, string> = {
  TEXT: "text-blue-500",
  IMAGE: "text-purple-500",
  AUDIO: "text-orange-500",
  VIDEO: "text-red-500",
  DOCUMENT: "text-green-500",
};

function BasicNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as StepNodeData;
  const InputIcon = IO_ICONS[nodeData.inputType] || Type;
  const OutputIcon = IO_ICONS[nodeData.outputType] || Type;
  const model = getModelById(nodeData.aiModel);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const stepNumber = useMemo(() => {
    const sorted = topologicalOrder(nodes, edges);
    return sorted.findIndex((n) => n.id === id) + 1;
  }, [nodes, edges, id]);

  return (
    <NodeShell
      id={id}
      selected={selected}
      accentColor="border-brand-500 shadow-brand-500/20"
      headerBg="bg-gray-50 dark:bg-gray-800/50"
      headerLabel={`Step ${stepNumber || nodeData.order}`}
      headerBadge={
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
          BASIC
        </span>
      }
    >
      <p className="font-medium text-sm truncate">
        {nodeData.label || "Untitled Step"}
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <Cpu className="w-3 h-3" />
        <span className="truncate">{model?.name || nodeData.aiModel || "No model"}</span>
        {model && (
          <span className="text-brand-500 font-medium">{model.costPerUse} NL</span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[10px]">
        <span className={`flex items-center gap-1 ${IO_COLORS[nodeData.inputType] || ""}`}>
          <InputIcon className="w-3 h-3" />
          {nodeData.inputType}
        </span>
        <span className="text-gray-300 dark:text-gray-600">→</span>
        <span className={`flex items-center gap-1 ${IO_COLORS[nodeData.outputType] || ""}`}>
          <OutputIcon className="w-3 h-3" />
          {nodeData.outputType}
        </span>
      </div>

      {nodeData.systemPrompt && (
        <div className="flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400">
          <Cpu className="w-3 h-3" />
          <span>System prompt set</span>
        </div>
      )}

      {(nodeData.customParams?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400">
          <Variable className="w-3 h-3" />
          <span>{nodeData.customParams!.filter(p => p.name).length} return param{nodeData.customParams!.filter(p => p.name).length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </NodeShell>
  );
}

export default memo(BasicNode);
