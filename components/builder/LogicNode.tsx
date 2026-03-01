import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch, Repeat, Wand2, Variable } from "lucide-react";
import { useWorkflowStore, topologicalOrder, type StepNodeData } from "@/lib/workflow-store";
import NodeShell from "./NodeShell";

const MODE_LABELS: Record<string, { label: string; icon: typeof GitBranch; color: string }> = {
  condition: { label: "If / Else", icon: GitBranch, color: "text-amber-500" },
  loop: { label: "Loop", icon: Repeat, color: "text-cyan-500" },
  transform: { label: "Transform", icon: Wand2, color: "text-amber-500" },
};

const OP_LABELS: Record<string, string> = {
  equals: "==",
  not_equals: "!=",
  contains: "contains",
  not_contains: "!contains",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: ">",
  less_than: "<",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  matches_regex: "~regex",
};

const TRANSFORM_LABELS: Record<string, string> = {
  uppercase: "UPPERCASE",
  lowercase: "lowercase",
  trim: "Trim",
  reverse: "Reverse",
  length: "Length",
  extract_json: "JSON Extract",
  replace: "Replace",
  split: "Split",
  join: "Join",
  template: "Template",
};

function LogicNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const mode = d.logicMode || "condition";
  const modeInfo = MODE_LABELS[mode] || MODE_LABELS.condition;
  const ModeIcon = modeInfo.icon;

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
      accentColor="border-amber-500 shadow-amber-500/20"
      headerBg="bg-amber-50 dark:bg-amber-900/20"
      headerLabel={`Step ${stepNumber || d.order}`}
      headerBadge={
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          LOGIC
        </span>
      }
    >
      <p className="font-medium text-sm truncate">
        {d.label || "Logic Gate"}
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <ModeIcon className={`w-3 h-3 ${modeInfo.color}`} />
        <span className="font-medium">{modeInfo.label}</span>
      </div>

      {mode === "condition" && d.logicCondition && (
        <div className="mt-1 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-[10px] font-mono text-amber-700 dark:text-amber-300 space-y-0.5">
          <div className="truncate">
            if {d.logicCondition.leftOperand || "{{input}}"}{" "}
            <span className="font-bold">{OP_LABELS[d.logicCondition.operator] || "=="}</span>{" "}
            {d.logicCondition.rightOperand || '""'}
          </div>
          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 truncate">
            then: {d.logicCondition.thenOutput || "{{input}}"}
          </div>
          <div className="text-[9px] text-red-500 dark:text-red-400 truncate">
            else: {d.logicCondition.elseOutput || '""'}
          </div>
        </div>
      )}

      {mode === "loop" && d.logicLoop && (
        <div className="mt-1 px-2 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-[10px] font-mono text-cyan-700 dark:text-cyan-300 space-y-0.5">
          <div className="truncate">
            split by: {d.logicLoop.delimiter === "\\n" ? "newline" : `"${d.logicLoop.delimiter || ","}" `}
          </div>
          <div className="truncate">
            each: {d.logicLoop.itemTemplate || "{{item}}"}
          </div>
        </div>
      )}

      {mode === "transform" && d.logicTransform && (
        <div className="mt-1 px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-[10px] font-mono text-purple-700 dark:text-purple-300">
          <span className="font-bold">{TRANSFORM_LABELS[d.logicTransform.operation] || d.logicTransform.operation}</span>
          {d.logicTransform.operand && (
            <span className="text-gray-500 ml-1 truncate">({d.logicTransform.operand})</span>
          )}
        </div>
      )}

      {(d.customParams?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 mt-1">
          <Variable className="w-3 h-3" />
          <span>
            {d.customParams!.filter((p) => p.name).length} return param
            {d.customParams!.filter((p) => p.name).length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </NodeShell>
  );
}

export default memo(LogicNode);
