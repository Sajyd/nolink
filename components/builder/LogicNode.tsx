import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch, Repeat } from "lucide-react";
import { useWorkflowStore, topologicalOrder, type StepNodeData } from "@/lib/workflow-store";
import NodeShell from "./NodeShell";

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

function LogicNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const mode = d.logicMode || "condition";
  const isWhile = mode === "while_loop";
  const ModeIcon = isWhile ? Repeat : GitBranch;

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const stepNumber = useMemo(() => {
    const sorted = topologicalOrder(nodes, edges);
    return sorted.findIndex((n) => n.id === id) + 1;
  }, [nodes, edges, id]);

  const cond = d.logicCondition;

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
      showSourceHandle={false}
    >
      <p className="font-medium text-sm truncate">
        {d.label || "Logic Gate"}
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <ModeIcon className={`w-3 h-3 ${isWhile ? "text-cyan-500" : "text-amber-500"}`} />
        <span className="font-medium">{isWhile ? "While Loop" : "If / Else"}</span>
      </div>

      {cond && (
        <div className="mt-1 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-[10px] font-mono text-amber-700 dark:text-amber-300">
          <div className="truncate">
            {isWhile ? "while" : "if"} {cond.leftOperand || "{{input}}"}{" "}
            <span className="font-bold">{OP_LABELS[cond.operator] || "=="}</span>{" "}
            {cond.rightOperand || '""'}
          </div>
        </div>
      )}

      {/* Custom source handles for branching */}
      <div className="relative mt-2">
        {isWhile ? (
          <>
            {/* loop handle */}
            <Handle
              type="source"
              position={Position.Right}
              id="loop"
              className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white dark:!border-gray-900"
              style={{ top: -4, right: -14 }}
            />
            <div className="text-[9px] text-cyan-600 dark:text-cyan-400 font-medium text-right pr-0" style={{ marginTop: -2 }}>
              loop ↻
            </div>
            {/* done handle */}
            <Handle
              type="source"
              position={Position.Right}
              id="done"
              className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-gray-900"
              style={{ top: 20, right: -14 }}
            />
            <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium text-right pr-0" style={{ marginTop: 2 }}>
              done ✓
            </div>
          </>
        ) : (
          <>
            {/* true handle */}
            <Handle
              type="source"
              position={Position.Right}
              id="true"
              className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-gray-900"
              style={{ top: -4, right: -14 }}
            />
            <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium text-right pr-0" style={{ marginTop: -2 }}>
              true ✓
            </div>
            {/* false handle */}
            <Handle
              type="source"
              position={Position.Right}
              id="false"
              className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-900"
              style={{ top: 20, right: -14 }}
            />
            <div className="text-[9px] text-red-500 dark:text-red-400 font-medium text-right pr-0" style={{ marginTop: 2 }}>
              false ✗
            </div>
          </>
        )}
      </div>
    </NodeShell>
  );
}

export default memo(LogicNode);
