import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Globe, Shield, ArrowRightLeft, Variable } from "lucide-react";
import type { StepNodeData } from "@/lib/workflow-store";
import NodeShell from "./NodeShell";

function CustomApiNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const params = d.customApiParams || [];
  const results = d.customApiResultFields || [];
  const method = d.customApiMethod || "POST";

  return (
    <NodeShell
      id={id}
      selected={selected}
      accentColor="border-rose-500 shadow-rose-500/20"
      headerBg="bg-rose-50 dark:bg-rose-900/20"
      headerLabel={`Step ${d.order}`}
      headerBadge={
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-rose-500 to-pink-500 text-white">
          API
        </span>
      }
    >
      <p className="font-medium text-sm truncate">
        {d.label || "Custom API"}
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <Globe className="w-3 h-3 text-rose-500" />
        <span className="font-mono text-[10px] truncate">
          {d.customApiUrl || "No URL configured"}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px] mt-0.5">
        <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold text-[9px]">
          {method}
        </span>
        {(d.customApiPrice ?? 0) > 0 && (
          <span className="text-rose-600 dark:text-rose-400 font-medium">
            {d.customApiPrice} NL
          </span>
        )}
        <span className="flex items-center gap-0.5 text-amber-500">
          <Shield className="w-2.5 h-2.5" />
          3rd party
        </span>
      </div>

      {params.filter((p) => p.key).length > 0 && (
        <div className="mt-1 space-y-0.5">
          {params
            .filter((p) => p.key)
            .slice(0, 3)
            .map((p, i) => {
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
          {params.filter((p) => p.key).length > 3 && (
            <p className="text-[9px] text-gray-400 text-center">
              +{params.filter((p) => p.key).length - 3} more params
            </p>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 mt-1">
          <ArrowRightLeft className="w-3 h-3" />
          <span>
            {results.length} result field{results.length !== 1 ? "s" : ""}
          </span>
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

export default memo(CustomApiNode);
