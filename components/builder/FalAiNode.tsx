import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Sparkles, Link2, PenLine } from "lucide-react";
import type { StepNodeData } from "@/lib/workflow-store";
import { getModelById } from "@/lib/models";
import NodeShell from "./NodeShell";

function FalAiNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as StepNodeData;
  const model = getModelById(nodeData.aiModel);
  const bindings = nodeData.paramBindings || {};
  const boundCount = Object.values(bindings).filter((v) => v && v !== "manual").length;
  const manualCount = model ? model.params.length - boundCount : 0;

  return (
    <NodeShell
      id={id}
      selected={selected}
      accentColor="border-amber-500 shadow-amber-500/20"
      headerBg="bg-amber-50 dark:bg-amber-900/20"
      headerLabel={`Step ${nodeData.order}`}
      headerBadge={
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          fal.ai
        </span>
      }
    >
      <p className="font-medium text-sm truncate">
        {nodeData.label || "fal.ai Step"}
      </p>

      {model ? (
        <>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="truncate">{model.name}</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {model.costPerUse} NL
            </span>
          </div>

          <p className="text-[10px] text-gray-400 truncate">{model.description}</p>

          <div className="flex items-center gap-2 text-[10px] mt-0.5">
            {boundCount > 0 && (
              <span className="flex items-center gap-0.5 text-blue-500">
                <Link2 className="w-2.5 h-2.5" />
                {boundCount} bound
              </span>
            )}
            {manualCount > 0 && (
              <span className="flex items-center gap-0.5 text-gray-400">
                <PenLine className="w-2.5 h-2.5" />
                {manualCount} manual
              </span>
            )}
          </div>

          {model.params.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {model.params.slice(0, 4).map((p) => {
                const binding = bindings[p.key];
                const isBound = binding && binding !== "manual";
                return (
                  <div
                    key={p.key}
                    className="flex items-center justify-between text-[9px] px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-800"
                  >
                    <span className="text-gray-500 truncate">{p.label}</span>
                    {isBound ? (
                      <span className="text-blue-500 font-medium">{binding}</span>
                    ) : (
                      <span className="text-gray-400">manual</span>
                    )}
                  </div>
                );
              })}
              {model.params.length > 4 && (
                <p className="text-[9px] text-gray-400 text-center">
                  +{model.params.length - 4} more params
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] text-gray-400">No model selected</p>
      )}
    </NodeShell>
  );
}

export default memo(FalAiNode);
