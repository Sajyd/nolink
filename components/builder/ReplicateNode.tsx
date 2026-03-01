import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Sparkles, Link2, PenLine, Variable, Zap, Clock } from "lucide-react";
import { useWorkflowStore, topologicalOrder, type StepNodeData } from "@/lib/workflow-store";
import { getModelById } from "@/lib/models";
import NodeShell from "./NodeShell";

function ReplicateNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as StepNodeData;
  const model = getModelById(nodeData.aiModel);
  const isCustom = nodeData.aiModel === "rep-custom";
  const bindings = nodeData.paramBindings || {};
  const boundCount = Object.values(bindings).filter((v) => v && v !== "manual").length;
  const manualCount = model && !isCustom ? model.params.length - boundCount : 0;
  const customReplicateParams = nodeData.customReplicateParams || [];
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
      accentColor="border-indigo-500 shadow-indigo-500/20"
      headerBg="bg-indigo-50 dark:bg-indigo-900/20"
      headerLabel={`Step ${stepNumber || nodeData.order}`}
      headerBadge={
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
          Replicate
        </span>
      }
    >
      <p className="font-medium text-sm truncate">
        {nodeData.label || "Replicate Step"}
      </p>

      {isCustom ? (
        <>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <Zap className="w-3 h-3 text-purple-500" />
            <span className="truncate">Custom Model</span>
            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              PRO
            </span>
            {(nodeData.customReplicatePrice ?? 0) > 0 && (
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                {nodeData.customReplicatePrice} NL
              </span>
            )}
          </div>

          {nodeData.customReplicateModel ? (
            <p className="text-[10px] font-mono text-indigo-500 truncate">
              {nodeData.customReplicateModel}
            </p>
          ) : (
            <p className="text-[10px] text-gray-400">No model configured</p>
          )}

          {customReplicateParams.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {customReplicateParams.filter(p => p.key).slice(0, 4).map((p, i) => {
                const isBound = p.value.startsWith("{{") && p.value.endsWith("}}");
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[9px] px-1.5 py-0.5 rounded bg-gray-50 dark:bg-gray-800"
                  >
                    <span className="text-gray-500 truncate font-mono">{p.key}</span>
                    {isBound ? (
                      <span className="text-blue-500 font-medium">{p.value}</span>
                    ) : (
                      <span className="text-gray-400 truncate max-w-[80px]">{p.value || "—"}</span>
                    )}
                  </div>
                );
              })}
              {customReplicateParams.filter(p => p.key).length > 4 && (
                <p className="text-[9px] text-gray-400 text-center">
                  +{customReplicateParams.filter(p => p.key).length - 4} more params
                </p>
              )}
            </div>
          )}
        </>
      ) : model ? (
        <>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span className="truncate">{model.name}</span>
            {model.comingSoon ? (
              <span className="flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <Clock className="w-2.5 h-2.5" />
                SOON
              </span>
            ) : (
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                {model.costPerUse} NL
              </span>
            )}
          </div>

          <p className="text-[10px] text-gray-400 truncate">{model.description}</p>

          {!model.comingSoon && (
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
          )}

          {!model.comingSoon && model.params.length > 0 && (
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

      {(nodeData.customParams?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 mt-1">
          <Variable className="w-3 h-3" />
          <span>{nodeData.customParams!.filter(p => p.name).length} return param{nodeData.customParams!.filter(p => p.name).length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </NodeShell>
  );
}

export default memo(ReplicateNode);
