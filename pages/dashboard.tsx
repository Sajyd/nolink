import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  Zap,
  Plus,
  TrendingUp,
  Wallet,
  BarChart3,
  Clock,
  Play,
  Trash2,
  ExternalLink,
  Package,
  CreditCard,
  Crown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  PiggyBank,
  Activity,
  Sparkles,
  X,
  Rocket,
  Store,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  CREDIT_PACKAGES,
  SUBSCRIPTION_PLANS,
  NL_TO_USD_CENTS,
  MINIMUM_PAYOUT_NL,
  PAYOUT_ELIGIBLE_TIERS,
  WORKFLOW_LIMITS,
} from "@/lib/constants";

interface Workflow {
  id: string;
  name: string;
  totalUses: number;
  totalEarnings: number;
  isPublic: boolean;
  last30dRuns: number;
  last30dRevenue: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  wallet: string;
  reason: string;
  createdAt: string;
}

interface Payout {
  id: string;
  amountNL: number;
  amountCents: number;
  status: string;
  stripeTransferId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ChartPoint {
  date: string;
  runs: number;
  revenueNL: number;
}

type TabId = "workflows" | "analytics" | "earnings" | "credits" | "history";

function nlToUsd(nl: number) {
  return (nl * NL_TO_USD_CENTS / 100).toFixed(2);
}

export default function Dashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>((router.query.tab as TabId) || "workflows");

  const [purchasedBalance, setPurchasedBalance] = useState(0);
  const [earnedBalance, setEarnedBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (router.query.tab) setTab(router.query.tab as TabId);
  }, [router.query.tab]);

  useEffect(() => {
    const tier = router.query.upgraded as string;
    if (tier) {
      const plan = SUBSCRIPTION_PLANS.find((p) => p.tier === tier);
      if (plan) {
        setUpgradeBanner(plan.name);
        update();
      }
      router.replace("/dashboard", undefined, { shallow: true });
    }
  }, [router.query.upgraded]);

  useEffect(() => {
    if (session) fetchAll();
  }, [session]);

  const fetchAll = async () => {
    setLoading(true);
    const [credRes, analyticsRes, payoutsRes] = await Promise.all([
      fetch("/api/credits/balance").then((r) => r.ok ? r.json() : null),
      fetch("/api/analytics/overview").then((r) => r.ok ? r.json() : null),
      fetch("/api/payouts/history").then((r) => r.ok ? r.json() : null),
    ]);

    if (credRes) {
      setPurchasedBalance(credRes.purchasedBalance);
      setEarnedBalance(credRes.earnedBalance);
      setTransactions(credRes.transactions);
    }
    if (analyticsRes) {
      setWorkflows(analyticsRes.workflows || []);
      setChartData(analyticsRes.chartData || []);
      setTotalEarnings(analyticsRes.totalEarnings || 0);
      setTotalRuns(analyticsRes.totalRuns || 0);
    }
    if (payoutsRes) setPayouts(payoutsRes);

    fetchConnectStatus();
    setLoading(false);
  };

  const fetchConnectStatus = async () => {
    try {
      const res = await fetch("/api/connect/status");
      if (res.ok) setConnectStatus(await res.json());
    } catch { /* ignore */ }
  };

  const handleDelete = async (workflowId: string) => {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" });
      if (res.ok) {
        setWorkflows((p) => p.filter((w) => w.id !== workflowId));
        toast.success("Workflow deleted");
      }
    } catch { toast.error("Failed to delete"); }
  };

  const handlePurchase = async (packageId: string) => {
    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error("Failed to create checkout");
    } catch { toast.error("Something went wrong"); }
  };

  const handleConnectStripe = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error(data.error || "Failed to start onboarding");
    } catch { toast.error("Something went wrong"); }
    setConnectLoading(false);
  };

  const handlePayout = async () => {
    const amount = parseInt(payoutAmount);
    if (!amount || amount < MINIMUM_PAYOUT_NL) {
      toast.error(`Minimum payout is ${MINIMUM_PAYOUT_NL} NL`);
      return;
    }
    if (amount > earnedBalance) {
      toast.error("Amount exceeds earned balance");
      return;
    }
    setPayoutLoading(true);
    try {
      const res = await fetch("/api/payouts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountNL: amount }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Payout of $${nlToUsd(amount)} initiated!`);
        setPayoutAmount("");
        setEarnedBalance((b) => b - amount);
        fetchAll();
        update();
      } else {
        toast.error(data.error || "Payout failed");
      }
    } catch { toast.error("Something went wrong"); }
    setPayoutLoading(false);
  };

  const handleSubscribe = async (tier: string) => {
    setUpgradeLoading(tier);
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
    setUpgradeLoading(null);
  };

  if (status === "loading" || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const workflowLimit = WORKFLOW_LIMITS[session.user.subscription] || 3;
  const canCreate = workflows.length < workflowLimit;
  const isPro = PAYOUT_ELIGIBLE_TIERS.includes(session.user.subscription as any);
  const maxBarRevenue = Math.max(...chartData.map((d) => d.revenueNL), 1);

  const TABS: { id: TabId; label: string }[] = [
    { id: "workflows", label: "My Workflows" },
    { id: "analytics", label: "Analytics" },
    { id: "earnings", label: "Earnings & Payouts" },
    { id: "credits", label: "Credits & Plans" },
    { id: "history", label: "History" },
  ];

  return (
    <>
      <Head><title>Dashboard — nolink.ai</title></Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {upgradeBanner && (
          <div className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-purple-600 to-brand-700 p-6 text-white shadow-lg">
            <button
              onClick={() => setUpgradeBanner(null)}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Welcome to {upgradeBanner}!
                  <Rocket className="w-5 h-5" />
                </h2>
                <p className="text-white/80 mt-1 text-sm">
                  Your plan is now active. You can create workflows, earn from the marketplace, and access all {upgradeBanner} features.
                </p>
                <div className="flex gap-3 mt-3">
                  <Link
                    href="/create-workflow"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-brand-700 text-sm font-semibold hover:bg-white/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Workflow
                  </Link>
                  <button
                    onClick={() => setUpgradeBanner(null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/20 text-sm font-medium hover:bg-white/30 transition-colors"
                  >
                    Explore Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Welcome back, {session.user.name || "there"}</p>
          </div>
          {session.user.subscription === "FREE" ? (
            <Link href="/dashboard?tab=credits" className="btn-secondary gap-2" title="Upgrade to create workflows">
              <Crown className="w-4 h-4" />Upgrade to Create
            </Link>
          ) : canCreate ? (
            <Link href="/create-workflow" className="btn-primary gap-2">
              <Plus className="w-4 h-4" />New Workflow
            </Link>
          ) : (
            <button disabled className="btn-secondary gap-2 opacity-60 cursor-not-allowed" title={`Limit: ${workflowLimit} workflows on ${session.user.subscription} plan`}>
              <Plus className="w-4 h-4" />Limit Reached
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Wallet className="w-4 h-4" />Purchased
            </div>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Zap className="w-5 h-5 text-brand-500" />
              {purchasedBalance} <span className="text-sm font-normal text-gray-400">NL</span>
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <PiggyBank className="w-4 h-4" />Earned
            </div>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Zap className="w-5 h-5 text-emerald-500" />
              {earnedBalance} <span className="text-sm font-normal text-gray-400">NL</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">${nlToUsd(earnedBalance)} USD</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <BarChart3 className="w-4 h-4" />Workflows
            </div>
            <p className="text-2xl font-bold">{workflows.length}<span className="text-sm font-normal text-gray-400">/{workflowLimit === 999999 ? "∞" : workflowLimit}</span></p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Play className="w-4 h-4" />Total Runs
            </div>
            <p className="text-2xl font-bold">{totalRuns}</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="w-4 h-4" />Lifetime Earnings
            </div>
            <p className="text-2xl font-bold flex items-center gap-1">
              {totalEarnings} <span className="text-sm font-normal text-gray-400">NL</span>
            </p>
            <p className="text-xs text-emerald-500 mt-0.5">${nlToUsd(totalEarnings)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); router.replace({ query: { tab: t.id } }, undefined, { shallow: true }); }}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >{t.label}</button>
          ))}
        </div>

        {/* ─── MY WORKFLOWS ──────────────────────────────── */}
        {tab === "workflows" && (
          <div>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-gray-100 dark:bg-gray-800" />)}</div>
            ) : workflows.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-500">No workflows yet</h3>
                {session.user.subscription === "FREE" ? (
                  <>
                    <p className="text-sm text-gray-400 mt-1 mb-5">Upgrade to a paid plan to create workflows, or explore what others have built</p>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => { setTab("credits"); router.replace({ query: { tab: "credits" } }, undefined, { shallow: true }); }} className="btn-primary gap-2 inline-flex"><Crown className="w-4 h-4" />View Plans</button>
                      <Link href="/marketplace" className="btn-secondary gap-2 inline-flex"><Store className="w-4 h-4" />Visit Marketplace</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400 mt-1 mb-5">Create your first AI workflow or explore the marketplace</p>
                    <div className="flex items-center justify-center gap-3">
                      <Link href="/create-workflow" className="btn-primary gap-2 inline-flex"><Plus className="w-4 h-4" />Create Workflow</Link>
                      <Link href="/marketplace" className="btn-secondary gap-2 inline-flex"><Store className="w-4 h-4" />Visit Marketplace</Link>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {workflows.map((wf) => (
                  <div key={wf.id} className="card p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{wf.name}</h3>
                        {wf.isPublic ? (
                          <span className="badge-green text-[10px] flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />Public</span>
                        ) : (
                          <span className="badge-gray text-[10px] flex items-center gap-0.5"><EyeOff className="w-2.5 h-2.5" />Private</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{wf.totalUses} runs</span>
                        <span className="text-emerald-500 font-medium">{wf.totalEarnings} NL earned (${nlToUsd(wf.totalEarnings)})</span>
                        <span className="text-gray-400">30d: {wf.last30dRuns} runs, {wf.last30dRevenue} NL</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/workflow/${wf.id}`} className="btn-ghost p-2"><ExternalLink className="w-4 h-4" /></Link>
                      <button onClick={() => handleDelete(wf.id)} className="btn-ghost p-2 text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── ANALYTICS ─────────────────────────────────── */}
        {tab === "analytics" && (
          <div className="space-y-6">
            <div className="card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-5 h-5" />Revenue (Last 30 Days)</h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No data yet — earnings will appear here after workflows are used</p>
              ) : (
                <div className="space-y-1">
                  {chartData.map((d) => (
                    <div key={d.date} className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-gray-400 shrink-0">{new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all" style={{ width: `${Math.max((d.revenueNL / maxBarRevenue) * 100, 2)}%` }} />
                      </div>
                      <span className="w-16 text-right font-medium text-emerald-600">{d.revenueNL} NL</span>
                      <span className="w-12 text-right text-gray-400">{d.runs} runs</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3">Top Workflows by Revenue</h3>
              <div className="space-y-2">
                {workflows.sort((a, b) => b.totalEarnings - a.totalEarnings).slice(0, 10).map((wf, i) => (
                  <div key={wf.id} className="card px-4 py-3 flex items-center gap-4">
                    <span className="w-6 text-center text-sm font-bold text-gray-400">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{wf.name}</p>
                      <p className="text-xs text-gray-400">{wf.totalUses} runs · 30d: {wf.last30dRuns} runs</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-emerald-600">{wf.totalEarnings} NL</p>
                      <p className="text-xs text-gray-400">${nlToUsd(wf.totalEarnings)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── EARNINGS & PAYOUTS ─────────────────────────── */}
        {tab === "earnings" && (
          <div className="space-y-6">
            {/* Earned balance card */}
            <div className="card p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 !border-emerald-200 dark:!border-emerald-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2"><PiggyBank className="w-5 h-5 text-emerald-600" />Earned Balance</h3>
                <span className="text-sm text-gray-500">Available for payout or usage</span>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-bold text-emerald-600">{earnedBalance} NL</p>
                <p className="text-xl text-gray-500">${nlToUsd(earnedBalance)} USD</p>
              </div>
              <p className="mt-2 text-xs text-gray-500">Earned from workflow commissions (70% of paid workflow runs). Use for your own workflows or withdraw to bank.</p>
            </div>

            {/* Stripe Connect status */}
            <div className="card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Link2 className="w-5 h-5" />Stripe Connect</h3>

              {!isPro ? (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <Crown className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-300">Pro Plan Required</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">Upgrade to Pro to withdraw earned Nolinks to real money via Stripe Connect.</p>
                    <button onClick={() => setTab("credits")} className="btn-primary mt-3 text-sm">View Plans</button>
                  </div>
                </div>
              ) : connectStatus?.onboarded ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">Stripe Connected</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Your account is fully set up for payouts</p>
                  </div>
                </div>
              ) : connectStatus?.connected ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-300">Onboarding Incomplete</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400">Finish setting up your Stripe account to enable payouts</p>
                    <button onClick={handleConnectStripe} disabled={connectLoading} className="btn-primary mt-3 text-sm gap-2">
                      {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      Complete Setup
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-3">Connect your Stripe account to withdraw earned Nolinks as real money.</p>
                  <button onClick={handleConnectStripe} disabled={connectLoading} className="btn-primary gap-2">
                    {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Connect Stripe Account
                  </button>
                </div>
              )}
            </div>

            {/* Payout request */}
            {isPro && connectStatus?.onboarded && (
              <div className="card p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5" />Request Payout</h3>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    <input
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      min={MINIMUM_PAYOUT_NL}
                      max={earnedBalance}
                      className="input-field pl-9"
                      placeholder={`Min ${MINIMUM_PAYOUT_NL} NL`}
                    />
                  </div>
                  <button onClick={handlePayout} disabled={payoutLoading || !payoutAmount} className="btn-primary gap-2">
                    {payoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                    Withdraw
                  </button>
                </div>
                {payoutAmount && parseInt(payoutAmount) > 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    You will receive <span className="font-semibold text-emerald-600">${nlToUsd(parseInt(payoutAmount))}</span> USD
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-400">Min {MINIMUM_PAYOUT_NL} NL (${ (MINIMUM_PAYOUT_NL * NL_TO_USD_CENTS / 100).toFixed(2)}) · Rate: 1 NL = ${(NL_TO_USD_CENTS / 100).toFixed(2)}</p>
              </div>
            )}

            {/* Payout history */}
            <div>
              <h3 className="font-semibold mb-3">Payout History</h3>
              {payouts.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-400">No payouts yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map((p) => (
                    <div key={p.id} className="card px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{p.amountNL} NL → ${(p.amountCents / 100).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`badge text-[10px] ${p.status === "COMPLETED" ? "badge-green" : p.status === "FAILED" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "badge-brand"}`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CREDITS & PLANS ────────────────────────────── */}
        {tab === "credits" && (
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" />Buy Nolinks</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {CREDIT_PACKAGES.map((pack) => (
                  <div key={pack.id} className="card p-5 text-center">
                    <p className="text-2xl font-bold flex items-center justify-center gap-1"><Zap className="w-5 h-5 text-brand-500" />{pack.nolinks}</p>
                    <p className="text-sm text-gray-500 mt-1">Nolinks</p>
                    <p className="text-xl font-bold mt-3">${(pack.priceInCents / 100).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-1">Added to purchased balance</p>
                    <button onClick={() => handlePurchase(pack.id)} className="btn-primary w-full mt-4">Purchase</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Crown className="w-5 h-5" />Subscription Plans</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <div key={plan.tier}
                    className={`card p-5 ${session.user.subscription === plan.tier ? "!border-brand-500 ring-2 ring-brand-500/20" : ""}`}
                  >
                    <h4 className="font-semibold">{plan.name}</h4>
                    <p className="text-2xl font-bold mt-2">{plan.priceInCents === 0 ? "Free" : `$${(plan.priceInCents / 100).toFixed(2)}/mo`}</p>
                    <p className="text-sm text-brand-500 mt-1">{plan.monthlyNolinks} NL/month</p>
                    <ul className="mt-4 space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="text-xs text-gray-500 dark:text-gray-400">✓ {f}</li>
                      ))}
                    </ul>
                    {(() => {
                      const tierOrder = ["FREE", "STARTER", "PRO", "POWER"];
                      const isCurrent = session.user.subscription === plan.tier;
                      const isDowngrade = tierOrder.indexOf(plan.tier) <= tierOrder.indexOf(session.user.subscription);
                      const isFree = plan.priceInCents === 0;

                      if (isCurrent) {
                        return (
                          <button className="mt-4 w-full btn-secondary" disabled>
                            Current Plan
                          </button>
                        );
                      }
                      if (isFree || isDowngrade) {
                        return (
                          <button className="mt-4 w-full btn-secondary opacity-50" disabled>
                            {isFree ? "Free Tier" : "Current or Lower"}
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => handleSubscribe(plan.tier)}
                          disabled={upgradeLoading === plan.tier}
                          className="mt-4 w-full btn-primary gap-2"
                        >
                          {upgradeLoading === plan.tier ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Crown className="w-4 h-4" />
                          )}
                          Upgrade
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── HISTORY ────────────────────────────────────── */}
        {tab === "history" && (
          <div>
            {transactions.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-500">No transactions yet</h3>
                <p className="text-sm text-gray-400 mt-1">Your credit history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="card px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tx.reason}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString()} · {tx.type.replace("_", " ")}
                        {tx.wallet !== "purchased" && (
                          <span className={`ml-2 ${tx.wallet === "earned" ? "text-emerald-500" : "text-brand-500"}`}>
                            {tx.wallet} wallet
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`font-semibold text-sm ${tx.amount > 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} NL
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
