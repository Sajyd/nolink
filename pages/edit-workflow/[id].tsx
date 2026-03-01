import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { ArrowLeft, Zap, Loader2, Check, CloudUpload, Menu, Settings2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import BuilderToolbar from "@/components/builder/BuilderToolbar";
import StepConfigPanel from "@/components/builder/StepConfigPanel";
import { useWorkflowStore, topologicalOrder, type StepNodeData, type CustomFalParam } from "@/lib/workflow-store";
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
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
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
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const loadedIdRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    setMobileConfigOpen(!!selectedNodeId);
  }, [selectedNodeId]);

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
            } else if (
              key !== "prompt" &&
              typeof val === "string" &&
              val.startsWith("{{") &&
              val.endsWith("}}")
            ) {
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
          systemPrompt: step.systemPrompt || "",
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
          fileBindings: (config.fileBindings as string[]) || undefined,
          inputParameters: (config.inputParameters as any[]) || undefined,
        };

        nodes.push({
          id: step.id,
          type: nodeType,
          position: { x: step.positionX || i * 300, y: step.positionY || 100 },
          data: nodeData,
        });
      }

      // Use stored edges if available, fall back to linear chain for legacy workflows
      let edges: Edge[];
      if (wf.edges && Array.isArray(wf.edges) && wf.edges.length > 0) {
        edges = (wf.edges as { id: string; source: string; target: string }[]).map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          animated: true,
        }));
      } else {
        edges = [];
        for (let i = 1; i < sortedSteps.length; i++) {
          edges.push({
            id: `e-${sortedSteps[i - 1].id}-${sortedSteps[i].id}`,
            source: sortedSteps[i - 1].id,
            target: sortedSteps[i].id,
            animated: true,
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
      edges: s.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
      steps: topologicalOrder(s.nodes, s.edges).map((n, idx) => {
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
          nodeId: n.id,
          order: idx + 1,
          name: n.data.label,
          stepType: stepTypeMap[n.type || "basicNode"] || "BASIC",
          aiModel: n.data.aiModel || null,
          inputType: n.data.inputType || "TEXT",
          outputType: n.data.outputType || "TEXT",
          prompt: n.data.prompt || "",
          systemPrompt: n.data.systemPrompt || "",
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
          fileBindings: (n.data.fileBindings && n.data.fileBindings.length > 0) ? n.data.fileBindings : null,
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
        <header className="flex items-center justify-between px-3 sm:px-4 h-14 border-b border-gray-200 dark:border-gray-800 glass">
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setMobileToolbarOpen(true)} className="md:hidden btn-ghost p-2">
              <Menu className="w-4 h-4" />
            </button>
            <Link href="/dashboard" className="btn-ghost p-2">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm hidden sm:inline">Edit Workflow</span>
              <span className="text-xs text-gray-400 font-mono truncate max-w-[200px] hidden sm:inline">
                {store.workflowName || "Untitled"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {autoSaveStatus === "saving" && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
                <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
                Saving…
              </span>
            )}
            {autoSaveStatus !== "saving" && lastSavedAt && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Last saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Autosave</span>
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

        <div className="flex-1 flex overflow-hidden relative">
          {/* Mobile backdrop */}
          {(mobileToolbarOpen || mobileConfigOpen) && (
            <div
              className="fixed inset-0 bg-black/40 z-30 md:hidden"
              onClick={() => { setMobileToolbarOpen(false); setMobileConfigOpen(false); }}
            />
          )}

          {/* Left sidebar – in-flow on md+, slide-in drawer on mobile */}
          <div className={`
            fixed top-14 left-0 bottom-0 z-40 shadow-2xl transition-transform duration-300
            md:static md:z-auto md:shadow-none md:translate-x-0 md:transition-none
            ${mobileToolbarOpen ? "translate-x-0" : "-translate-x-full"}
          `}>
            <BuilderToolbar
              onSave={handleSave}
              saving={saving}
              workflowId={typeof id === "string" ? id : null}
              onClose={() => setMobileToolbarOpen(false)}
            />
          </div>

          {/* Canvas */}
          <WorkflowCanvas />

          {/* Right sidebar – in-flow on md+, slide-in drawer on mobile */}
          <div className={`
            fixed top-14 right-0 bottom-0 z-40 shadow-2xl transition-transform duration-300
            md:static md:z-auto md:shadow-none md:translate-x-0 md:transition-none
            ${mobileConfigOpen ? "translate-x-0" : "translate-x-full"}
          `}>
            <StepConfigPanel />
          </div>

          {/* Mobile floating button – open config panel */}
          {selectedNodeId && !mobileConfigOpen && (
            <button
              onClick={() => setMobileConfigOpen(true)}
              className="md:hidden fixed bottom-20 right-4 z-20 p-3 rounded-full bg-brand-600 text-white shadow-lg active:scale-95 transition-transform"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
