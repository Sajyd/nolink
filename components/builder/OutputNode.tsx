import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Download, Type, Image, Mic, Video, FileText, Variable } from "lucide-react";
import type { StepNodeData } from "@/lib/workflow-store";
import NodeShell from "./NodeShell";

const OUTPUT_ICONS: Record<string, typeof Type> = {
  TEXT: Type,
  IMAGE: Image,
  AUDIO: Mic,
  VIDEO: Video,
  DOCUMENT: FileText,
};

function OutputNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as StepNodeData;
  const Icon = OUTPUT_ICONS[nodeData.outputType] || Download;

  return (
    <NodeShell
      id={id}
      selected={selected}
      accentColor="border-violet-500 shadow-violet-500/20"
      headerBg="bg-violet-50 dark:bg-violet-900/20"
      headerLabel="Final Output"
      headerBadge={
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500 text-white">
          OUT
        </span>
      }
      showTargetHandle={true}
      showSourceHandle={false}
    >
      <p className="font-medium text-sm truncate">
        {nodeData.label || "Final Output"}
      </p>

      <div className="flex items-center gap-2 mt-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-violet-500 bg-violet-50 dark:bg-violet-900/20">
          <Icon className="w-2.5 h-2.5" />
          {nodeData.outputType}
        </span>
      </div>

      <p className="text-[10px] text-gray-400 mt-1">
        Delivered to the user as the workflow result
      </p>

      {(nodeData.customParams?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 mt-1">
          <Variable className="w-3 h-3" />
          <span>{nodeData.customParams!.filter(p => p.name).length} return param{nodeData.customParams!.filter(p => p.name).length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </NodeShell>
  );
}

export default memo(OutputNode);
