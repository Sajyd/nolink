import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  Wrench, Type, Hash, Repeat, Music, Film, Globe, Code, FileText, Calculator,
} from "lucide-react";
import { useWorkflowStore, topologicalOrder, type StepNodeData, type UtilityOperation } from "@/lib/workflow-store";
import NodeShell from "./NodeShell";

const OP_INFO: Record<UtilityOperation, { label: string; icon: typeof Wrench; color: string }> = {
  uppercase: { label: "UPPERCASE", icon: Type, color: "text-purple-500" },
  lowercase: { label: "lowercase", icon: Type, color: "text-purple-500" },
  trim: { label: "Trim", icon: Type, color: "text-purple-500" },
  reverse: { label: "Reverse", icon: Type, color: "text-purple-500" },
  length: { label: "Length", icon: Hash, color: "text-purple-500" },
  word_count: { label: "Word Count", icon: Hash, color: "text-purple-500" },
  replace: { label: "Replace", icon: Type, color: "text-purple-500" },
  split: { label: "Split", icon: Type, color: "text-purple-500" },
  join: { label: "Join", icon: Type, color: "text-purple-500" },
  template: { label: "Template", icon: FileText, color: "text-purple-500" },
  extract_json: { label: "JSON Extract", icon: Code, color: "text-blue-500" },
  regex_extract: { label: "Regex Extract", icon: Code, color: "text-blue-500" },
  url_encode: { label: "URL Encode", icon: Globe, color: "text-teal-500" },
  url_decode: { label: "URL Decode", icon: Globe, color: "text-teal-500" },
  base64_encode: { label: "Base64 Encode", icon: Code, color: "text-teal-500" },
  base64_decode: { label: "Base64 Decode", icon: Code, color: "text-teal-500" },
  for_each: { label: "For Each", icon: Repeat, color: "text-cyan-500" },
  math_add: { label: "Add (+)", icon: Calculator, color: "text-orange-500" },
  math_subtract: { label: "Subtract (−)", icon: Calculator, color: "text-orange-500" },
  math_multiply: { label: "Multiply (×)", icon: Calculator, color: "text-orange-500" },
  math_divide: { label: "Divide (÷)", icon: Calculator, color: "text-orange-500" },
  math_modulo: { label: "Modulo (%)", icon: Calculator, color: "text-orange-500" },
  math_round: { label: "Round", icon: Calculator, color: "text-orange-500" },
  math_abs: { label: "Absolute", icon: Calculator, color: "text-orange-500" },
  math_min: { label: "Min", icon: Calculator, color: "text-orange-500" },
  math_max: { label: "Max", icon: Calculator, color: "text-orange-500" },
  math_expression: { label: "Expression", icon: Calculator, color: "text-orange-500" },
  audio_duration: { label: "Audio Duration", icon: Music, color: "text-pink-500" },
  video_duration: { label: "Video Duration", icon: Film, color: "text-pink-500" },
  media_info: { label: "Media Info", icon: Film, color: "text-pink-500" },
};

function UtilityNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const operation = d.utilityConfig?.operation || "uppercase";
  const info = OP_INFO[operation] || OP_INFO.uppercase;
  const OpIcon = info.icon;

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
      accentColor="border-purple-500 shadow-purple-500/20"
      headerBg="bg-purple-50 dark:bg-purple-900/20"
      headerLabel={`Step ${stepNumber || d.order}`}
      headerBadge={
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
          UTIL
        </span>
      }
    >
      <p className="font-medium text-sm truncate">
        {d.label || "Utility"}
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <OpIcon className={`w-3 h-3 ${info.color}`} />
        <span className="font-medium">{info.label}</span>
      </div>

      {d.utilityConfig && (
        <div className="mt-1 px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-[10px] font-mono text-purple-700 dark:text-purple-300">
          {operation === "for_each" && (
            <div className="truncate">
              split: {d.utilityConfig.delimiter === "\\n" ? "newline" : `"${d.utilityConfig.delimiter || ","}"`}
              {d.utilityConfig.itemTemplate && ` → ${d.utilityConfig.itemTemplate}`}
            </div>
          )}
          {operation === "replace" && (
            <div className="truncate">
              {d.utilityConfig.operand || "..."} → {d.utilityConfig.replacement || "..."}
            </div>
          )}
          {operation === "template" && (
            <div className="truncate">{d.utilityConfig.operand || "{{input}}"}</div>
          )}
          {operation === "extract_json" && (
            <div className="truncate">path: {d.utilityConfig.operand || "..."}</div>
          )}
          {operation === "regex_extract" && (
            <div className="truncate">/{d.utilityConfig.operand || "..."}/</div>
          )}
          {["math_add", "math_subtract", "math_multiply", "math_divide", "math_modulo"].includes(operation) && d.utilityConfig.operand && (
            <div className="truncate">
              input {operation === "math_add" ? "+" : operation === "math_subtract" ? "−" : operation === "math_multiply" ? "×" : operation === "math_divide" ? "÷" : "%"} {d.utilityConfig.operand}
            </div>
          )}
          {operation === "math_expression" && d.utilityConfig.operand && (
            <div className="truncate">{d.utilityConfig.operand}</div>
          )}
          {operation === "math_round" && (
            <div className="truncate">to {d.utilityConfig.operand || "0"} decimals</div>
          )}
          {["audio_duration", "video_duration", "media_info"].includes(operation) && (
            <div className="truncate">from media URL</div>
          )}
        </div>
      )}
    </NodeShell>
  );
}

export default memo(UtilityNode);
