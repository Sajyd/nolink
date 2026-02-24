import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Upload, Type, Image, Mic, Video, FileText, Variable } from "lucide-react";
import type { StepNodeData } from "@/lib/workflow-store";
import NodeShell from "./NodeShell";

const ACCEPT_ICONS: Record<string, typeof Type> = {
  text: Type,
  image: Image,
  audio: Mic,
  video: Video,
  document: FileText,
};

const ACCEPT_COLORS: Record<string, string> = {
  text: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  image: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
  audio: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  video: "text-red-500 bg-red-50 dark:bg-red-900/20",
  document: "text-green-500 bg-green-50 dark:bg-green-900/20",
};

function InputNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as StepNodeData;
  const accepts = nodeData.acceptTypes || ["text"];

  return (
    <NodeShell
      id={id}
      selected={selected}
      accentColor="border-emerald-500 shadow-emerald-500/20"
      headerBg="bg-emerald-50 dark:bg-emerald-900/20"
      headerLabel="User Input"
      headerBadge={
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white">
          IN
        </span>
      }
      showTargetHandle={false}
      showSourceHandle={true}
    >
      <p className="font-medium text-sm truncate">
        {nodeData.label || "User Input"}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-1">
        {accepts.map((type) => {
          const Icon = ACCEPT_ICONS[type] || Upload;
          return (
            <span
              key={type}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                ACCEPT_COLORS[type] || "text-gray-500 bg-gray-100"
              }`}
            >
              <Icon className="w-2.5 h-2.5" />
              {type}
            </span>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 mt-1">
        Accepts {accepts.length > 1 ? "multiple formats" : accepts[0]} from user
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

export default memo(InputNode);
