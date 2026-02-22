import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { ArrowLeft, Zap, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import BuilderToolbar from "@/components/builder/BuilderToolbar";
import StepConfigPanel from "@/components/builder/StepConfigPanel";
import { useWorkflowStore, type StepNodeData, type CustomFalParam } from "@/lib/workflow-store";
import ThemeToggle from "@/components/ThemeToggle";
import type { Node, Edge } from "@xyflow/react";

const WorkflowCanvas = dynamic(
  () => import("@/components/builder/WorkflowCanvas"),
  { ssr: false }
);

const STEP_TYPE_TO_NODE: Record<string, string> = {
  INPUT: "inputNode",
  OUTPUT: "outputNode",
  BASIC: "basicNode",
  FAL_AI: "falAiNode",
  CUSTOM_API: "customApiNode",
};

export default function EditWorkflow() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const store = useWorkflowStore();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (id && session) loadWorkflow();
    return () => { store.reset(); };
  }, [id, session]);

  const loadWorkflow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) throw new Error("Not found");
      const wf = await res.json();

      if (wf.creatorId !== session?.user?.id) {
        setLoadError("You can only edit your own workflows.");
        setLoading(false);
        return;
      }

      store.setEditingWorkflowId(wf.id);
      store.setWorkflowName(wf.name);
      store.setWorkflowDescription(wf.description || "");
      store.setWorkflowCategory(wf.category || "OTHER");
      store.setWorkflowPrice(wf.priceInNolinks || 0);
      store.setIsPublic(wf.isPublic ?? true);
      store.setExampleInput(wf.exampleInput || "");
      store.setExampleOutput(wf.exampleOutput || "");

      const nodes: Node<StepNodeData>[] = [];
      const edges: Edge[] = [];

      const sortedSteps = [...wf.steps].sort((a: any, b: any) => a.order - b.order);

      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        const nodeType = STEP_TYPE_TO_NODE[step.stepType] || "basicNode";
        const config = (step.config as Record<string, unknown>) || {};

        const modelParams: Record<string, unknown> = {};
        const paramBindings: Record<string, string> = {};

        if (step.params) {
          for (const [key, val] of Object.entries(step.params as Record<string, unknown>)) {
            if (typeof val === "string" && val.startsWith("{{") && val.endsWith("}}")) {
              paramBindings[key] = val;
            } else {
              modelParams[key] = val;
            }
          }
        }

        const nodeData: StepNodeData = {
          label: step.name,
          stepType: nodeType as any,
          aiModel: step.aiModel || "",
          inputType: step.inputType || "TEXT",
          outputType: step.outputType || "TEXT",
          prompt: step.prompt || "",
          order: step.order,
          acceptTypes: step.acceptTypes || [],
          modelParams: Object.keys(modelParams).length > 0 ? modelParams : undefined,
          paramBindings: Object.keys(paramBindings).length > 0 ? paramBindings : undefined,
          customParams: (config.customParams as any[]) || undefined,
          customFalEndpoint: (config.customFalEndpoint as string) || undefined,
          customFalParams: (config.customFalParams as CustomFalParam[]) || undefined,
          customApiUrl: (config.customApiUrl as string) || undefined,
          customApiMethod: (config.customApiMethod as any) || undefined,
          customApiHeaders: (config.customApiHeaders as any[]) || undefined,
          customApiParams: (config.customApiParams as any[]) || undefined,
          customApiResultFields: (config.customApiResultFields as any[]) || undefined,
          customApiPrice: (config.customApiPrice as number) ?? undefined,
        };

        nodes.push({
          id: step.id,
          type: nodeType,
          position: { x: step.positionX || i * 300, y: step.positionY || 100 },
          data: nodeData,
        });

        if (i > 0) {
          edges.push({
            id: `e-${sortedSteps[i - 1].id}-${step.id}`,
            source: sortedSteps[i - 1].id,
            target: step.id,
          });
        }
      }

      store.setNodes(nodes);
      store.setEdges(edges);
    } catch {
      setLoadError("Failed to load workflow");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (store.nodes.length === 0) {
      toast.error("Add at least one step");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: store.workflowName || "Untitled Workflow",
          description: store.workflowDescription,
          category: store.workflowCategory,
          priceInNolinks: store.workflowPrice,
          isPublic: store.isPublic,
          exampleInput: store.exampleInput || null,
          exampleOutput: store.exampleOutput || null,
          steps: store.nodes.map((n) => {
            const stepTypeMap: Record<string, string> = {
              inputNode: "INPUT",
              outputNode: "OUTPUT",
              falAiNode: "FAL_AI",
              basicNode: "BASIC",
              stepNode: "BASIC",
              customApiNode: "CUSTOM_API",
            };
            const mergedParams = { ...(n.data.modelParams || {}) };
            const bindings = n.data.paramBindings || {};
            for (const [key, binding] of Object.entries(bindings)) {
              if (binding && binding !== "manual") {
                mergedParams[key] = binding;
              }
            }
            const validCustomParams = (n.data.customParams || []).filter(
              (p: { name: string; value: string }) => p.name.trim() !== ""
            );
            const isCustomFal = n.data.aiModel === "fal-custom";
            const validFalParams = (n.data.customFalParams || []).filter(
              (p: { key: string; value: string }) => p.key.trim() !== ""
            );
            const isCustomApi = n.type === "customApiNode";
            return {
              order: n.data.order,
              name: n.data.label,
              stepType: stepTypeMap[n.type || "basicNode"] || "BASIC",
              aiModel: n.data.aiModel || null,
              inputType: n.data.inputType || "TEXT",
              outputType: n.data.outputType || "TEXT",
              prompt: n.data.prompt || "",
              modelParams: Object.keys(mergedParams).length > 0 ? mergedParams : null,
              customParams: validCustomParams.length > 0 ? validCustomParams : null,
              customFalEndpoint: isCustomFal ? (n.data.customFalEndpoint || null) : null,
              customFalParams: isCustomFal && validFalParams.length > 0 ? validFalParams : null,
              customApiUrl: isCustomApi ? (n.data.customApiUrl || null) : null,
              customApiMethod: isCustomApi ? (n.data.customApiMethod || "POST") : null,
              customApiHeaders: isCustomApi ? (n.data.customApiHeaders || []) : null,
              customApiParams: isCustomApi ? (n.data.customApiParams || []) : null,
              customApiResultFields: isCustomApi ? (n.data.customApiResultFields || []) : null,
              customApiPrice: isCustomApi ? (n.data.customApiPrice ?? 0) : null,
              acceptTypes: n.data.acceptTypes || [],
              positionX: n.position.x,
              positionY: n.position.y,
            };
          }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Workflow updated!");
      store.reset();
      router.push(`/workflow/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <span className="text-gray-500">Loading workflow...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500 font-medium">{loadError}</p>
        <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800 glass">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Edit Workflow</span>
            <span className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
              {store.workflowName || "Untitled"}
            </span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <BuilderToolbar onSave={handleSave} saving={saving} />
        <WorkflowCanvas />
        <StepConfigPanel />
      </div>
    </div>
  );
}
