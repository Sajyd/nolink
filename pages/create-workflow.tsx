import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { ArrowLeft, Crown, Loader2 } from "lucide-react";
import AppLogo from "@/components/AppLogo";
import Link from "next/link";
import toast from "react-hot-toast";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import BuilderToolbar from "@/components/builder/BuilderToolbar";
import StepConfigPanel from "@/components/builder/StepConfigPanel";
import { useWorkflowStore } from "@/lib/workflow-store";
import ThemeToggle from "@/components/ThemeToggle";

const WorkflowCanvas = dynamic(
  () => import("@/components/builder/WorkflowCanvas"),
  { ssr: false }
);

export default function CreateWorkflow() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const store = useWorkflowStore();
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (store.nodes.length === 0) {
      toast.error("Add at least one step");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: store.workflowName || "Untitled Workflow",
          description: store.workflowDescription,
          category: store.workflowCategory,
          priceInNolinks: store.workflowPrice,
          isPublic: store.isPublic,
          steps: store.nodes.map((n) => {
            const stepTypeMap: Record<string, string> = {
              inputNode: "INPUT",
              outputNode: "OUTPUT",
              falAiNode: "FAL_AI",
              basicNode: "BASIC",
              stepNode: "BASIC",
            };
            const mergedParams = { ...(n.data.modelParams || {}) };
            const bindings = n.data.paramBindings || {};
            for (const [key, binding] of Object.entries(bindings)) {
              if (binding && binding !== "manual") {
                mergedParams[key] = binding;
              }
            }
            return {
              order: n.data.order,
              name: n.data.label,
              stepType: stepTypeMap[n.type || "basicNode"] || "BASIC",
              aiModel: n.data.aiModel || null,
              inputType: n.data.inputType || "TEXT",
              outputType: n.data.outputType || "TEXT",
              prompt: n.data.prompt || "",
              modelParams: Object.keys(mergedParams).length > 0 ? mergedParams : null,
              acceptTypes: n.data.acceptTypes || [],
              positionX: n.position.x,
              positionY: n.position.y,
            };
          }),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      toast.success("Workflow saved!");
      store.reset();
      router.push(`/workflow/${data.id}`);
    } catch {
      toast.error("Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-800 glass">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="font-semibold text-sm">Workflow Builder</span>
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
