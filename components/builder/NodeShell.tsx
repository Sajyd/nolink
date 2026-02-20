import { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { GripVertical, X } from "lucide-react";
import { useWorkflowStore } from "@/lib/workflow-store";
import { playRemoveNode } from "@/lib/sounds";

interface NodeShellProps {
  id: string;
  selected?: boolean;
  accentColor: string;     // tailwind border color class when selected
  headerBg: string;        // header background class
  headerLabel: string;     // e.g. "Step 1", "Input", "Output"
  headerBadge?: ReactNode;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
  children: ReactNode;
}

export default function NodeShell({
  id,
  selected,
  accentColor,
  headerBg,
  headerLabel,
  headerBadge,
  showSourceHandle = true,
  showTargetHandle = true,
  children,
}: NodeShellProps) {
  const { removeNode, setSelectedNodeId } = useWorkflowStore();

  return (
    <div
      className={`min-w-[220px] max-w-[260px] rounded-xl border-2 bg-white dark:bg-gray-900 shadow-lg transition-all ${
        selected ? `${accentColor} shadow-lg` : "border-gray-200 dark:border-gray-700"
      }`}
      onDoubleClick={() => setSelectedNodeId(id)}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-brand-500 !border-2 !border-white dark:!border-gray-900"
        />
      )}

      <div className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 rounded-t-xl ${headerBg}`}>
        <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-grab" />
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex-1 truncate">
          {headerLabel}
        </span>
        {headerBadge}
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeNode(id);
            playRemoveNode();
          }}
          className="nopan nodrag p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="px-3 py-3 space-y-2">{children}</div>

      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-brand-500 !border-2 !border-white dark:!border-gray-900"
        />
      )}
    </div>
  );
}
