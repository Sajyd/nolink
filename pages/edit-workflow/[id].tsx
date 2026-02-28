import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { ArrowLeft, Zap, Loader2, Check, CloudUpload, Undo2, Redo2 } from "lucide-react";
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
  const [autoSave, setAutoSave] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nolink-autosave") !== "false";
    }
    return true;
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    const workflowId = typeof id === "string" ? id : undefined;
    if (workflowId && session && loadedIdRef.current !== workflowId) {
      loadedIdRef.current = workflowId;
      loadWorkflow();
    }
    return () => { store.reset(); loadedIdRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (key === "image_urls" && Array.isArray(val)) {
              const urls: string[] = [];
              (val as string[]).forEach((v, i) => {
                if (typeof v === "string" && v.startsWith("{{") && v.endsWith("}}")) {
                  paramBindings[`image_urls_${i}`] = v;
                  urls.push("");
                } else {
                  urls.push(v as string);
                }
              });
              modelParams.image_urls = urls;
            } else if (typeof val === "string" && val.startsWith("{{") && val.endsWith("}}")) {
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
          inputParameters: (config.inputParameters as any[]) || undefined,
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
    initialLoadDoneRef.current = true;
    setLoading(false);
  };

  const buildSavePayload = useCallback(() => {
    const s = useWorkflowStore.getState();
    return {
      name: s.workflowName || "Untitled Workflow",
      description: s.workflowDescription,
      category: s.workflowCategory,
      priceInNolinks: s.workflowPrice,
      isPublic: s.isPublic,
      exampleInput: s.exampleInput || null,
      exampleOutput: s.exampleOutput || null,
      steps: s.nodes.map((n) => {
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
          if (!binding || binding === "manual") continue;
          const arrMatch = key.match(/^image_urls_(\d+)$/);
          if (arrMatch) {
            const arr = Array.isArray(mergedParams.image_urls) ? [...(mergedParams.image_urls as string[])] : [];
            arr[parseInt(arrMatch[1])] = binding;
            mergedParams.image_urls = arr;
          } else {
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
          inputParameters: (n.data.inputParameters || []).filter(
            (p: { name: string }) => p.name.trim() !== ""
          ),
          positionX: n.position.x,
          positionY: n.position.y,
        };
      }),
    };
  }, []);

  const performSave = useCallback(async (silent: boolean) => {
    const s = useWorkflowStore.getState();
    if (s.nodes.length === 0) {
      if (!silent) toast.error("Add at least one step");
      return;
    }

    if (silent) {
      setAutoSaveStatus("saving");
    } else {
      setSaving(true);
    }

    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload()),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const now = new Date();
      setLastSavedAt(now);
      if (silent) {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } else {
        toast.success("Workflow saved!");
      }
    } catch (err) {
      if (silent) {
        setAutoSaveStatus("idle");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save workflow");
      }
    } finally {
      if (!silent) setSaving(false);
    }
  }, [id, buildSavePayload]);

  const handleSave = () => performSave(false);

  useEffect(() => {
    localStorage.setItem("nolink-autosave", String(autoSave));
  }, [autoSave]);

  useEffect(() => {
    if (!autoSave) return;
    const unsub = useWorkflowStore.subscribe(() => {
      if (!initialLoadDoneRef.current || !id) return;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        performSave(true);
      }, 1500);
    });
    return () => {
      unsub();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [id, autoSave, performSave]);

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
    <>
      <Head><title>Edit Workflow — nolink.ai</title></Head>
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
            <div className="ml-2 flex items-center gap-0.5 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => store.undo()}
                disabled={store._past.length === 0}
                title="Undo (⌘Z)"
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => store.redo()}
                disabled={store._future.length === 0}
                title="Redo (⌘⇧Z)"
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {autoSaveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
                Saving…
              </span>
            )}
            {autoSaveStatus !== "saving" && lastSavedAt && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Last saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-gray-500 dark:text-gray-400">Autosave</span>
              <button
                role="switch"
                aria-checked={autoSave}
                onClick={() => setAutoSave((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  autoSave
                    ? "bg-brand-500"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                    autoSave ? "translate-x-[22px]" : "translate-x-[2px]"
                  } mt-[2px]`}
                />
              </button>
            </label>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <BuilderToolbar onSave={handleSave} saving={saving} workflowId={typeof id === "string" ? id : null} />
          <WorkflowCanvas />
          <StepConfigPanel />
        </div>
      </div>
    </>
  );
}
