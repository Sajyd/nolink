import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { ArrowLeft, Zap, Crown, Loader2, CloudUpload, Check, Menu, Settings2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import BuilderToolbar from "@/components/builder/BuilderToolbar";
import StepConfigPanel from "@/components/builder/StepConfigPanel";
import { useWorkflowStore, topologicalOrder } from "@/lib/workflow-store";
import ThemeToggle from "@/components/ThemeToggle";

const WorkflowCanvas = dynamic(
  () => import("@/components/builder/WorkflowCanvas"),
  { ssr: false }
);

export default function CreateWorkflow() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const store = useWorkflowStore();
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nolink-autosave") !== "false";
    }
    return true;
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (store.editingWorkflowId) {
      store.reset();
    }
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    setMobileConfigOpen(!!selectedNodeId);
  }, [selectedNodeId]);

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  if (session.user.subscription === "FREE") {
    return <SubscriptionGate />;
  }

  const buildPayload = useCallback(() => {
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

    if (!silent) setSaving(true);
    if (silent) setAutoSaveStatus("saving");

    try {
      const payload = buildPayload();

      if (workflowId) {
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        const res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save");
        const data = await res.json();
        setWorkflowId(data.id);
      }

      const now = new Date();
      setLastSavedAt(now);
      if (silent) {
        setAutoSaveStatus("saved");
        setTimeout(() => { if (mountedRef.current) setAutoSaveStatus("idle"); }, 2000);
      } else {
        toast.success("Workflow saved!");
      }
    } catch {
      if (silent) {
        setAutoSaveStatus("idle");
      } else {
        toast.error("Failed to save workflow");
      }
    } finally {
      if (!silent) setSaving(false);
    }
  }, [buildPayload, workflowId]);

  const handleSave = () => performSave(false);

  useEffect(() => {
    localStorage.setItem("nolink-autosave", String(autoSave));
  }, [autoSave]);

  useEffect(() => {
    if (!autoSave) return;
    const unsub = useWorkflowStore.subscribe(() => {
      if (!mountedRef.current) return;
      const s = useWorkflowStore.getState();
      if (s.nodes.length === 0) return;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        performSave(true);
      }, 2000);
    });
    return () => {
      unsub();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [autoSave, performSave]);

  return (
    <>
      <Head><title>Create Workflow — nolink.ai</title></Head>
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
              <span className="font-semibold text-sm hidden sm:inline">Workflow Builder</span>
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
              workflowId={workflowId}
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

function SubscriptionGate() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: string) => {
    setLoading(tier);
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to start checkout");
      }
    } catch {
      toast.error("Something went wrong");
    }
    setLoading(null);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center max-w-lg px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg">
          <Crown className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Unlock Workflow Creation</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Upgrade to a paid plan to build, publish, and earn from AI workflows.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 text-left">
          {SUBSCRIPTION_PLANS.filter((p) => p.priceInCents > 0).slice(0, 2).map((plan) => (
            <div key={plan.tier} className={`card p-5 ${plan.tier === "STARTER" ? "" : "!border-brand-500 ring-2 ring-brand-500/20"}`}>
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="text-xl font-bold mt-1">${(plan.priceInCents / 100).toFixed(2)}<span className="text-sm font-normal text-gray-400">/mo</span></p>
              <p className="text-xs text-brand-500 mt-1">{plan.monthlyNolinks} NL/month</p>
              <ul className="mt-3 space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-xs text-gray-500 dark:text-gray-400">&#10003; {f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.tier)}
                disabled={loading === plan.tier}
                className="btn-primary w-full mt-4 gap-2 text-sm"
              >
                {loading === plan.tier ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Get {plan.name}
              </button>
            </div>
          ))}
        </div>
        <Link href="/dashboard" className="inline-block mt-6 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
