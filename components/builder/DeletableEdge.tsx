import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useWorkflowStore } from "@/lib/workflow-store";

const HANDLE_LABELS: Record<string, { text: string; color: string }> = {
  true: { text: "true", color: "bg-emerald-500 text-white" },
  false: { text: "false", color: "bg-red-500 text-white" },
  loop: { text: "loop", color: "bg-cyan-500 text-white" },
  done: { text: "done", color: "bg-emerald-500 text-white" },
};

export default function DeletableEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const takeSnapshot = useWorkflowStore((s) => s.takeSnapshot);
  const nodes = useWorkflowStore((s) => s.nodes);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const sourceNode = nodes.find((n) => n.id === source);
  const isFromLogicGate = sourceNode?.type === "logicNode";
  const handleLabel = sourceHandleId && isFromLogicGate ? HANDLE_LABELS[sourceHandleId] : null;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          {handleLabel && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${handleLabel.color}`}>
              {handleLabel.text}
            </span>
          )}
          <button
            onClick={() => {
              takeSnapshot();
              setEdges((edges) => edges.filter((e) => e.id !== id));
            }}
            className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
            style={{ opacity: undefined }}
            title="Remove connection"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
