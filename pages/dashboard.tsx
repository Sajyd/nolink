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
  Pencil,
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
  Palette,
  Upload,
  Image as ImageIcon,
  LifeBuoy,
  Mail,
  MessageSquare,
  ArrowLeft,
  Send,
  ChevronRight,
  CircleDot,
  Settings,
  Bell,
  Megaphone,
  Shield,
  UserCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";
import {
  CREDIT_PACKAGES,
  SUBSCRIPTION_PLANS,
  NL_TO_USD_CENTS,
  NL_TO_EUR_CENTS,
  MINIMUM_PAYOUT_NL,
  PAYOUT_ELIGIBLE_TIERS,
  WORKFLOW_LIMITS,
  SUPPORT_EMAIL,
  SUPPORT_ADMIN_EMAILS,
  TICKET_ELIGIBLE_TIERS,
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
  payoutMethod: "STRIPE" | "WISE";
  currency: string;
  status: string;
  stripeTransferId: string | null;
  wiseTransferId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ChartPoint {
  date: string;
  runs: number;
  revenueNL: number;
}

type TabId = "workflows" | "analytics" | "earnings" | "credits" | "history" | "branding" | "support" | "settings";

interface SupportTicket {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string; image: string | null; subscription: string };
  messages: TicketMessage[];
  _count?: { messages: number };
}

interface TicketMessage {
  id: string;
  body: string;
  isAdmin: boolean;
  createdAt: string;
  user: { name: string | null; email: string; image: string | null };
}

function nlToUsd(nl: number) {
  return (nl * NL_TO_USD_CENTS / 100).toFixed(2);
}

function nlToEur(nl: number) {
  return (nl * NL_TO_EUR_CENTS / 100).toFixed(2);
}

export default function Dashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>((router.query.tab as TabId) || "workflows");

  const [bonusBalance, setBonusBalance] = useState(0);
  const [purchasedBalance, setPurchasedBalance] = useState(0);
  const [earnedBalance, setEarnedBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);
  const [payoutMethodTab, setPayoutMethodTab] = useState<"STRIPE" | "WISE">("STRIPE");
  const [wiseStatus, setWiseStatus] = useState<{ iban: string | null; ibanAccountHolder: string | null; wiseReady: boolean } | null>(null);
  const [ibanInput, setIbanInput] = useState("");
  const [ibanHolderInput, setIbanHolderInput] = useState("");
  const [wiseSetupLoading, setWiseSetupLoading] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingUploading, setBrandingUploading] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketView, setTicketView] = useState<"list" | "new" | "detail">("list");
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketBody, setNewTicketBody] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [ticketReply, setTicketReply] = useState("");
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED">("ALL");

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailMarketing, setEmailMarketing] = useState(true);
  const [emailPrefLoading, setEmailPrefLoading] = useState(false);
  const [emailPrefSaving, setEmailPrefSaving] = useState(false);

  const { t } = useTranslation();

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
    const connectParam = router.query.connect as string;
    if (connectParam === "complete") {
      fetchConnectStatus();
      toast.success(t("dashboard.stripeAccountConnected"));
      router.replace("/dashboard?tab=earnings", undefined, { shallow: true });
    } else if (connectParam === "refresh") {
      toast(t("dashboard.onboardingIncompleteToast"), { icon: "⚠️" });
      router.replace("/dashboard?tab=earnings", undefined, { shallow: true });
    }
  }, [router.query.connect]);

  useEffect(() => {
    if (session) fetchAll();
  }, [session]);

  useEffect(() => {
    if (tab === "branding" && session?.user?.subscription === "ENTERPRISE") {
      fetchBranding();
    }
  }, [tab, session]);

  const fetchAll = async () => {
    setLoading(true);
    const [credRes, analyticsRes, payoutsRes] = await Promise.all([
      fetch("/api/credits/balance").then((r) => r.ok ? r.json() : null),
      fetch("/api/analytics/overview").then((r) => r.ok ? r.json() : null),
      fetch("/api/payouts/history").then((r) => r.ok ? r.json() : null),
    ]);

    if (credRes) {
      setBonusBalance(credRes.bonusBalance);
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
    fetchWiseStatus();
    setLoading(false);
  };

  const fetchConnectStatus = async () => {
    try {
      const res = await fetch("/api/connect/status");
      if (res.ok) setConnectStatus(await res.json());
    } catch { /* ignore */ }
  };

  const fetchWiseStatus = async () => {
    try {
      const res = await fetch("/api/wise/setup");
      if (res.ok) {
        const data = await res.json();
        setWiseStatus(data);
        if (data.payoutMethod === "WISE") setPayoutMethodTab("WISE");
      }
    } catch { /* ignore */ }
  };

  const handleWiseSetup = async () => {
    if (!ibanInput.trim() || !ibanHolderInput.trim()) {
      toast.error("Please enter both IBAN and account holder name");
      return;
    }
    setWiseSetupLoading(true);
    try {
      const res = await fetch("/api/wise/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iban: ibanInput.trim(), accountHolder: ibanHolderInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("IBAN saved and Wise recipient created");
        setWiseStatus({ iban: data.iban, ibanAccountHolder: data.ibanAccountHolder, wiseReady: true });
        setIbanInput("");
        setIbanHolderInput("");
        update();
      } else {
        toast.error(data.error || data.message || "Failed to set up Wise");
      }
    } catch { toast.error("Something went wrong"); }
    setWiseSetupLoading(false);
  };

  const handleDelete = async (workflowId: string) => {
    if (!confirm(t("dashboard.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" });
      if (res.ok) {
        setWorkflows((p) => p.filter((w) => w.id !== workflowId));
        toast.success(t("dashboard.workflowDeleted"));
      }
    } catch { toast.error(t("dashboard.failedToDelete")); }
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
      else toast.error(t("dashboard.failedToCreateCheckout"));
    } catch { toast.error(t("common.somethingWentWrong")); }
  };

  const handleConnectStripe = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error(data.error || t("common.somethingWentWrong"));
    } catch { toast.error(t("common.somethingWentWrong")); }
    setConnectLoading(false);
  };

  const handleConnectDashboard = async () => {
    try {
      const res = await fetch("/api/connect/dashboard", { method: "POST" });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
      else toast.error(data.error || t("common.somethingWentWrong"));
    } catch { toast.error(t("common.somethingWentWrong")); }
  };

  const handlePayout = async () => {
    const amount = parseInt(payoutAmount);
    if (!amount || amount < MINIMUM_PAYOUT_NL) {
      toast.error(t("dashboard.minimumPayout", { min: String(MINIMUM_PAYOUT_NL) }));
      return;
    }
    if (amount > earnedBalance) {
      toast.error(t("dashboard.exceedsBalance"));
      return;
    }
    setPayoutLoading(true);
    try {
      const res = await fetch("/api/payouts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountNL: amount, payoutMethod: payoutMethodTab }),
      });
      const data = await res.json();
      if (data.success) {
        const displayAmount = payoutMethodTab === "WISE" ? `€${nlToEur(amount)}` : `$${nlToUsd(amount)}`;
        toast.success(t("dashboard.payoutInitiated", { amount: displayAmount }));
        setPayoutAmount("");
        setEarnedBalance((b) => b - amount);
        fetchAll();
        update();
      } else {
        toast.error(data.error || t("dashboard.payoutFailed"));
      }
    } catch { toast.error(t("common.somethingWentWrong")); }
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
        toast.error(data.error || t("dashboard.checkoutFailed"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    }
    setUpgradeLoading(null);
  };

  const fetchBranding = async () => {
    setBrandingLoading(true);
    try {
      const res = await fetch("/api/branding");
      if (res.ok) {
        const data = await res.json();
        setBrandName(data.brandName || "");
        setBrandLogoUrl(data.brandLogoUrl || "");
        if (data.brandLogoUrl) setBrandLogoPreview(data.brandLogoUrl);
      }
    } catch { /* ignore */ }
    setBrandingLoading(false);
  };

  const handleBrandLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("branding.logoImageOnly"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("branding.logoTooLarge"));
      return;
    }

    setBrandingUploading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{ name: file.name, mimeType: file.type, size: file.size }],
        }),
      });
      if (!res.ok) {
        toast.error(t("workflow.uploadFailed"));
        setBrandingUploading(false);
        return;
      }
      const data = await res.json();
      const upload = data.files[0];

      await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": upload.mimeType },
        body: file,
      });

      setBrandLogoUrl(upload.url);
      setBrandLogoPreview(URL.createObjectURL(file));
      toast.success(t("branding.logoUploaded"));
    } catch {
      toast.error(t("common.somethingWentWrong"));
    }
    setBrandingUploading(false);
  };

  const handleSaveBranding = async () => {
    setBrandingSaving(true);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim(),
          brandLogoUrl: brandLogoUrl || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t("branding.saved"));
        update();
      } else {
        toast.error(data.error || t("common.somethingWentWrong"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    }
    setBrandingSaving(false);
  };

  const fetchTickets = async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets");
      if (res.ok) setTickets(await res.json());
    } catch { /* ignore */ }
    setTicketsLoading(false);
  };

  const fetchTicketDetail = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data);
        setTicketView("detail");
      }
    } catch { toast.error(t("common.somethingWentWrong")); }
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketBody.trim()) return;
    setTicketSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newTicketSubject, body: newTicketBody, priority: newTicketPriority }),
      });
      if (res.ok) {
        toast.success(t("support.ticketCreated"));
        setNewTicketSubject("");
        setNewTicketBody("");
        setNewTicketPriority("MEDIUM");
        setTicketView("list");
        fetchTickets();
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.somethingWentWrong"));
      }
    } catch { toast.error(t("common.somethingWentWrong")); }
    setTicketSubmitting(false);
  };

  const handleTicketReply = async () => {
    if (!ticketReply.trim() || !selectedTicket) return;
    setReplySubmitting(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: ticketReply }),
      });
      if (res.ok) {
        toast.success(t("support.replySent"));
        setTicketReply("");
        fetchTicketDetail(selectedTicket.id);
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.somethingWentWrong"));
      }
    } catch { toast.error(t("common.somethingWentWrong")); }
    setReplySubmitting(false);
  };

  const handleTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const msg = newStatus === "CLOSED" ? t("support.ticketClosed") : t("support.ticketReopened");
        toast.success(msg);
        fetchTicketDetail(ticketId);
        fetchTickets();
      }
    } catch { toast.error(t("common.somethingWentWrong")); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!session) return;
    const eligible = SUPPORT_ADMIN_EMAILS.includes(session.user.email as any) ||
      TICKET_ELIGIBLE_TIERS.includes(session.user.subscription as any);
    if (eligible && tab === "support") fetchTickets();
  }, [session, tab]);

  const fetchEmailPreferences = async () => {
    setEmailPrefLoading(true);
    try {
      const res = await fetch("/api/user/email-preferences");
      if (res.ok) {
        const data = await res.json();
        setEmailNotifications(data.emailNotifications);
        setEmailMarketing(data.emailMarketing);
      }
    } catch { /* ignore */ }
    setEmailPrefLoading(false);
  };

  const saveEmailPreferences = async (notifications: boolean, marketing: boolean) => {
    setEmailPrefSaving(true);
    try {
      const res = await fetch("/api/user/email-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: notifications, emailMarketing: marketing }),
      });
      if (res.ok) {
        toast.success(t("settings.saved"));
      } else {
        toast.error(t("settings.saveFailed"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    }
    setEmailPrefSaving(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (session && tab === "settings") fetchEmailPreferences(); }, [session, tab]);

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

  const isEnterprise = session.user.subscription === "ENTERPRISE";
  const isAdmin = SUPPORT_ADMIN_EMAILS.includes(session.user.email as any);
  const canUseTickets = isAdmin || TICKET_ELIGIBLE_TIERS.includes(session.user.subscription as any);

  const TABS: { id: TabId; label: string }[] = [
    { id: "workflows", label: t("dashboard.tabWorkflows") },
    { id: "analytics", label: t("dashboard.tabAnalytics") },
    { id: "earnings", label: t("dashboard.tabEarnings") },
    { id: "credits", label: t("dashboard.tabCredits") },
    { id: "history", label: t("dashboard.tabHistory") },
    ...(isEnterprise ? [{ id: "branding" as const, label: t("dashboard.tabBranding") }] : []),
    { id: "support", label: t("support.tabSupport") },
    { id: "settings", label: t("settings.tabSettings") },
  ];

  return (
    <>
      <Head>
        <title>{t("dashboard.title")}</title>
        <meta name="description" content={t("dashboard.metaDescription")} />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

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
                  {t("dashboard.welcomeToPlan", { plan: upgradeBanner! })}
                  <Rocket className="w-5 h-5" />
                </h2>
                <p className="text-white/80 mt-1 text-sm">
                  {t("dashboard.planActiveDesc", { plan: upgradeBanner! })}
                </p>
                <div className="flex gap-3 mt-3">
                  <Link
                    href="/create-workflow"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-brand-700 text-sm font-semibold hover:bg-white/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("dashboard.createFirstWorkflow")}
                  </Link>
                  <button
                    onClick={() => setUpgradeBanner(null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/20 text-sm font-medium hover:bg-white/30 transition-colors"
                  >
                    {t("dashboard.exploreDashboard")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t("dashboard.header")}</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{t("dashboard.welcomeBack", { name: session.user.name || t("dashboard.there") })}</p>
          </div>
          {session.user.subscription === "FREE" ? (
            <Link href="/dashboard?tab=credits" className="btn-secondary gap-2" title={t("dashboard.upgradeToCreate")}>
              <Crown className="w-4 h-4" />{t("dashboard.upgradeToCreate")}
            </Link>
          ) : canCreate ? (
            <Link href="/create-workflow" className="btn-primary gap-2">
              <Plus className="w-4 h-4" />{t("dashboard.newWorkflow")}
            </Link>
          ) : (
            <button disabled className="btn-secondary gap-2 opacity-60 cursor-not-allowed" title={t("dashboard.limitReachedTooltip", { limit: String(workflowLimit), plan: session.user.subscription })}>
              <Plus className="w-4 h-4" />{t("dashboard.limitReached")}
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Sparkles className="w-4 h-4" />{t("dashboard.bonus")}
            </div>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Zap className="w-5 h-5 text-amber-500" />
              {bonusBalance} <span className="text-sm font-normal text-gray-400">NL</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{t("dashboard.freeCredits")}</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Wallet className="w-4 h-4" />{t("dashboard.purchased")}
            </div>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Zap className="w-5 h-5 text-brand-500" />
              {purchasedBalance} <span className="text-sm font-normal text-gray-400">NL</span>
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <PiggyBank className="w-4 h-4" />{t("dashboard.earned")}
            </div>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Zap className="w-5 h-5 text-emerald-500" />
              {earnedBalance} <span className="text-sm font-normal text-gray-400">NL</span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{t("dashboard.usdWithdrawable", { amount: nlToUsd(earnedBalance) })}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <BarChart3 className="w-4 h-4" />{t("dashboard.workflows")}
            </div>
            <p className="text-2xl font-bold">{workflows.length}<span className="text-sm font-normal text-gray-400">/{workflowLimit === 999999 ? "∞" : workflowLimit}</span></p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Play className="w-4 h-4" />{t("dashboard.totalRuns")}
            </div>
            <p className="text-2xl font-bold">{totalRuns}</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="w-4 h-4" />{t("dashboard.lifetimeEarnings")}
            </div>
            <p className="text-2xl font-bold flex items-center gap-1">
              {totalEarnings} <span className="text-sm font-normal text-gray-400">NL</span>
            </p>
            <p className="text-xs text-emerald-500 mt-0.5">${nlToUsd(totalEarnings)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {TABS.map((tb) => (
            <button key={tb.id} onClick={() => { setTab(tb.id); router.replace({ query: { tab: tb.id } }, undefined, { shallow: true }); }}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === tb.id ? "border-brand-500 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >{tb.label}</button>
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
                <h3 className="text-lg font-semibold text-gray-500">{t("dashboard.noWorkflows")}</h3>
                {session.user.subscription === "FREE" ? (
                  <>
                    <p className="text-sm text-gray-400 mt-1 mb-5">{t("dashboard.noWorkflowsFreeDesc")}</p>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => { setTab("credits"); router.replace({ query: { tab: "credits" } }, undefined, { shallow: true }); }} className="btn-primary gap-2 inline-flex"><Crown className="w-4 h-4" />{t("common.viewPlans")}</button>
                      <Link href="/marketplace" className="btn-secondary gap-2 inline-flex"><Store className="w-4 h-4" />{t("dashboard.visitMarketplace")}</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400 mt-1 mb-5">{t("dashboard.noWorkflowsPaidDesc")}</p>
                    <div className="flex items-center justify-center gap-3">
                      <Link href="/create-workflow" className="btn-primary gap-2 inline-flex"><Plus className="w-4 h-4" />{t("dashboard.createWorkflow")}</Link>
                      <Link href="/marketplace" className="btn-secondary gap-2 inline-flex"><Store className="w-4 h-4" />{t("dashboard.visitMarketplace")}</Link>
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
                          <span className="badge-green text-[10px] flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{t("common.public")}</span>
                        ) : (
                          <span className="badge-gray text-[10px] flex items-center gap-0.5"><EyeOff className="w-2.5 h-2.5" />{t("common.private")}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{wf.totalUses} {t("common.runs")}</span>
                        <span className="text-emerald-500 font-medium">{wf.totalEarnings} {t("dashboard.nlEarned")} (${nlToUsd(wf.totalEarnings)})</span>
                        <span className="text-gray-400">{t("dashboard.thirtyDays", { runs: String(wf.last30dRuns), revenue: String(wf.last30dRevenue) })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/edit-workflow/${wf.id}`} className="btn-ghost p-2" title={t("dashboard.editWorkflow")}><Pencil className="w-4 h-4" /></Link>
                      <Link href={`/workflow/${wf.id}`} className="btn-ghost p-2" title={t("dashboard.viewWorkflow")}><ExternalLink className="w-4 h-4" /></Link>
                      <button onClick={() => handleDelete(wf.id)} className="btn-ghost p-2 text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20" title={t("dashboard.deleteWorkflow")}><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-5 h-5" />{t("dashboard.revenue30Days")}</h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">{t("dashboard.noDataYet")}</p>
              ) : (
                <div className="space-y-1">
                  {chartData.map((d) => (
                    <div key={d.date} className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-gray-400 shrink-0">{new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all" style={{ width: `${Math.max((d.revenueNL / maxBarRevenue) * 100, 2)}%` }} />
                      </div>
                      <span className="w-16 text-right font-medium text-emerald-600">{d.revenueNL} NL</span>
                      <span className="w-12 text-right text-gray-400">{d.runs} {t("common.runs")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3">{t("dashboard.topWorkflows")}</h3>
              <div className="space-y-2">
                {workflows.sort((a, b) => b.totalEarnings - a.totalEarnings).slice(0, 10).map((wf, i) => (
                  <div key={wf.id} className="card px-4 py-3 flex items-center gap-4">
                    <span className="w-6 text-center text-sm font-bold text-gray-400">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{wf.name}</p>
                      <p className="text-xs text-gray-400">{wf.totalUses} {t("common.runs")} · {t("dashboard.thirtyDays", { runs: String(wf.last30dRuns), revenue: String(wf.last30dRevenue) })}</p>
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
                <h3 className="font-semibold flex items-center gap-2"><PiggyBank className="w-5 h-5 text-emerald-600" />{t("dashboard.earnedBalance")}</h3>
                <span className="text-sm text-gray-500">{t("dashboard.availableForPayout")}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-bold text-emerald-600">{earnedBalance} NL</p>
                <p className="text-xl text-gray-500">${nlToUsd(earnedBalance)} USD</p>
                <p className="text-lg text-gray-400">{"\u2248"} {"\u20AC"}{nlToEur(earnedBalance)} EUR</p>
              </div>
              <p className="mt-2 text-xs text-gray-500">{t("dashboard.earnedExplanation")}</p>
            </div>

            {!isPro ? (
              <div className="card p-6">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <Crown className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-300">{t("dashboard.proRequired")}</p>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{t("dashboard.proRequiredDesc")}</p>
                    <button onClick={() => setTab("credits")} className="btn-primary mt-3 text-sm">{t("common.viewPlans")}</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Payout method selector */}
                <div className="card p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><Link2 className="w-5 h-5" />Payout Method</h3>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPayoutMethodTab("STRIPE")}
                      className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${payoutMethodTab === "STRIPE" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300" : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"}`}
                    >
                      <DollarSign className="w-4 h-4 inline mr-1.5" />
                      Stripe Connect (USD)
                    </button>
                    <button
                      onClick={() => setPayoutMethodTab("WISE")}
                      className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${payoutMethodTab === "WISE" ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300" : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"}`}
                    >
                      <ArrowUpRight className="w-4 h-4 inline mr-1.5" />
                      Wise IBAN (EUR)
                    </button>
                  </div>

                  {/* Stripe Connect setup */}
                  {payoutMethodTab === "STRIPE" && (
                    <>
                      {connectStatus?.onboarded ? (
                        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div>
                              <p className="font-medium text-emerald-700 dark:text-emerald-300">{t("dashboard.stripeConnected")}</p>
                              <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("dashboard.stripeConnectedDesc")}</p>
                            </div>
                          </div>
                          <button onClick={handleConnectDashboard} className="btn-ghost text-sm gap-1.5 shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t("dashboard.stripeDashboard")}
                          </button>
                        </div>
                      ) : connectStatus?.connected ? (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                          <div>
                            <p className="font-medium text-amber-700 dark:text-amber-300">{t("dashboard.onboardingIncomplete")}</p>
                            <p className="text-sm text-amber-600 dark:text-amber-400">{t("dashboard.onboardingIncompleteDesc")}</p>
                            <button onClick={handleConnectStripe} disabled={connectLoading} className="btn-primary mt-3 text-sm gap-2">
                              {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                              {t("dashboard.completeSetup")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-500 mb-3">{t("dashboard.connectStripeDesc")}</p>
                          <button onClick={handleConnectStripe} disabled={connectLoading} className="btn-primary gap-2">
                            {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                            {t("dashboard.connectStripeAccount")}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Wise IBAN setup */}
                  {payoutMethodTab === "WISE" && (
                    <>
                      {wiseStatus?.wiseReady ? (
                        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div>
                              <p className="font-medium text-emerald-700 dark:text-emerald-300">Wise IBAN connected</p>
                              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                {wiseStatus.ibanAccountHolder} &middot; {wiseStatus.iban?.replace(/(.{4})/g, "$1 ").trim()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setWiseStatus({ ...wiseStatus, wiseReady: false })}
                            className="btn-ghost text-sm shrink-0"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">Enter your IBAN bank details to receive payouts via Wise in EUR.</p>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Account Holder Name</label>
                            <input
                              type="text"
                              value={ibanHolderInput}
                              onChange={(e) => setIbanHolderInput(e.target.value)}
                              className="input-field"
                              placeholder="John Doe"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">IBAN</label>
                            <input
                              type="text"
                              value={ibanInput}
                              onChange={(e) => setIbanInput(e.target.value.toUpperCase())}
                              className="input-field font-mono"
                              placeholder="FR76 3000 6000 0112 3456 7890 189"
                            />
                          </div>
                          <button
                            onClick={handleWiseSetup}
                            disabled={wiseSetupLoading || !ibanInput || !ibanHolderInput}
                            className="btn-primary gap-2"
                          >
                            {wiseSetupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Save IBAN
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Payout request */}
                {((payoutMethodTab === "STRIPE" && connectStatus?.onboarded) || (payoutMethodTab === "WISE" && wiseStatus?.wiseReady)) && (
                  <div className="card p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5" />{t("dashboard.requestPayout")}</h3>
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
                          placeholder={t("dashboard.payoutPlaceholder", { min: String(MINIMUM_PAYOUT_NL) })}
                        />
                      </div>
                      <button onClick={handlePayout} disabled={payoutLoading || !payoutAmount} className="btn-primary gap-2">
                        {payoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                        {t("dashboard.withdraw")} ({payoutMethodTab === "WISE" ? "EUR" : "USD"})
                      </button>
                    </div>
                    {payoutAmount && parseInt(payoutAmount) > 0 && (
                      <p className="mt-2 text-sm text-gray-500">
                        You will receive {payoutMethodTab === "WISE" ? `€${nlToEur(parseInt(payoutAmount))} EUR` : `$${nlToUsd(parseInt(payoutAmount))} USD`} via {payoutMethodTab === "WISE" ? "Wise" : "Stripe"}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      Min {MINIMUM_PAYOUT_NL} NL ({payoutMethodTab === "WISE" ? `€${(MINIMUM_PAYOUT_NL * NL_TO_EUR_CENTS / 100).toFixed(2)}` : `$${(MINIMUM_PAYOUT_NL * NL_TO_USD_CENTS / 100).toFixed(2)}`}) &middot; Rate: 1 NL = {payoutMethodTab === "WISE" ? `€${(NL_TO_EUR_CENTS / 100).toFixed(2)}` : `$${(NL_TO_USD_CENTS / 100).toFixed(2)}`}
                    </p>
                    <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {t("dashboard.withdrawalInfo")}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Payout history */}
            <div>
              <h3 className="font-semibold mb-3">{t("dashboard.payoutHistory")}</h3>
              {payouts.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-400">{t("dashboard.noPayouts")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map((p) => {
                    const sym = p.currency === "EUR" ? "\u20AC" : "$";
                    const method = p.payoutMethod === "WISE" ? "Wise" : "Stripe";
                    return (
                      <div key={p.id} className="card px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{p.amountNL} NL {"\u2192"} {sym}{(p.amountCents / 100).toFixed(2)} {p.currency}</p>
                          <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()} &middot; {method}</p>
                        </div>
                        <span className={`badge text-[10px] ${p.status === "COMPLETED" ? "badge-green" : p.status === "FAILED" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "badge-brand"}`}>
                          {p.status === "COMPLETED" ? t("dashboard.statusCompleted") : p.status === "FAILED" ? t("dashboard.statusFailed") : p.status === "PROCESSING" ? t("dashboard.statusProcessing") : t("dashboard.statusPending")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CREDITS & PLANS ────────────────────────────── */}
        {tab === "credits" && (
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" />{t("dashboard.buyNolinks")}</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {CREDIT_PACKAGES.map((pack) => (
                  <div key={pack.id} className="card p-5 text-center">
                    <p className="text-2xl font-bold flex items-center justify-center gap-1"><Zap className="w-5 h-5 text-brand-500" />{pack.nolinks}</p>
                    <p className="text-sm text-gray-500 mt-1">{t("common.nolinks")}</p>
                    <p className="text-xl font-bold mt-3">${(pack.priceInCents / 100).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-1">{t("dashboard.addedToPurchased")}</p>
                    <button onClick={() => handlePurchase(pack.id)} className="btn-primary w-full mt-4">{t("common.purchase")}</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Crown className="w-5 h-5" />{t("dashboard.subscriptionPlans")}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const tierOrder = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
                  const isCurrent = session.user.subscription === plan.tier;
                  const isDowngrade = tierOrder.indexOf(plan.tier) < tierOrder.indexOf(session.user.subscription);
                  const isFree = plan.priceInCents === 0;
                  const isUpgrade = !isCurrent && !isDowngrade && !isFree;

                  return (
                    <div key={plan.tier}
                      className={`card p-5 relative flex flex-col ${isCurrent ? "!border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/50 dark:bg-brand-950/20" : ""}`}
                    >
                      {isCurrent && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-600 text-white text-[11px] font-semibold">
                          {t("common.yourPlan")}
                        </span>
                      )}
                      <h4 className="font-semibold">{t(plan.nameKey)}</h4>
                      <p className="text-2xl font-bold mt-2">{plan.priceInCents === 0 ? t("common.free") : `$${(plan.priceInCents / 100).toFixed(2)}${t("dashboard.perMonth")}`}</p>
                      <p className="text-sm text-brand-500 mt-1">{plan.monthlyNolinks} {t("dashboard.nlPerMonth")}</p>
                      <ul className="mt-4 space-y-1.5 flex-1">
                        {plan.featureKeys.map((fk) => (
                          <li key={fk} className="text-xs text-gray-500 dark:text-gray-400">✓ {t(fk)}</li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <button className="mt-4 w-full btn-secondary gap-2 cursor-default" disabled>
                          <CheckCircle2 className="w-4 h-4" />
                          {t("common.currentPlan")}
                        </button>
                      ) : isUpgrade ? (
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
                          {t("common.upgrade")}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
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
                <h3 className="text-lg font-semibold text-gray-500">{t("dashboard.noTransactions")}</h3>
                <p className="text-sm text-gray-400 mt-1">{t("dashboard.creditHistory")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="card px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tx.reason}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString()} · {
                          tx.type === "WORKFLOW_USE" ? t("dashboard.txWorkflowUse") :
                          tx.type === "CREATOR_EARNING" ? t("dashboard.txCreatorEarning") :
                          tx.type === "PURCHASE" ? t("dashboard.txPurchase") :
                          tx.type === "SUBSCRIPTION" ? t("dashboard.txSubscription") :
                          tx.type === "PAYOUT" ? t("dashboard.txPayout") :
                          tx.type === "BONUS" ? t("dashboard.txBonus") :
                          tx.type === "REFUND" ? t("dashboard.txRefund") :
                          tx.type.replace("_", " ")
                        }
                        {tx.wallet !== "purchased" && (
                          <span className={`ml-2 ${tx.wallet === "earned" ? "text-emerald-500" : "text-brand-500"}`}>
                            {tx.wallet === "bonus" ? t("dashboard.walletBonus") : tx.wallet === "earned" ? t("dashboard.walletEarned") : t("dashboard.walletPurchased")}
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

        {/* ─── BRANDING (Enterprise only) ────────────────── */}
        {tab === "branding" && isEnterprise && (
          <div className="space-y-6">
            <div className="card p-6 bg-gradient-to-br from-purple-50 to-brand-50 dark:from-purple-900/20 dark:to-brand-900/20 !border-purple-200 dark:!border-purple-800">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("branding.title")}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("branding.desc")}</p>
                </div>
              </div>
            </div>

            {brandingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : (
              <div className="card p-6 space-y-6">
                {/* Brand Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("branding.nameLabel")}
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="input-field"
                    placeholder={t("branding.namePlaceholder")}
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-400 mt-1">{t("branding.nameHint")}</p>
                </div>

                {/* Brand Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("branding.logoLabel")}
                  </label>

                  {brandLogoPreview ? (
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-16 h-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center">
                        <img
                          src={brandLogoPreview}
                          alt="Brand logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400">{t("branding.logoCurrently")}</p>
                        <button
                          onClick={() => {
                            setBrandLogoUrl("");
                            setBrandLogoPreview(null);
                          }}
                          className="text-xs text-red-500 hover:text-red-600 mt-1 transition-colors"
                        >
                          {t("branding.logoRemove")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleBrandLogoUpload}
                      className="hidden"
                      disabled={brandingUploading}
                    />
                    {brandingUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                    ) : (
                      <Upload className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-500">
                      {brandLogoPreview
                        ? t("branding.logoReplace")
                        : t("branding.logoUpload")}
                    </span>
                  </label>
                  <p className="text-xs text-gray-400 mt-1">{t("branding.logoHint")}</p>
                </div>

                {/* Preview */}
                {(brandName || brandLogoPreview) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t("branding.preview")}
                    </label>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                      <div className="flex items-center gap-3">
                        {brandLogoPreview && (
                          <img
                            src={brandLogoPreview}
                            alt="Brand logo preview"
                            className="w-8 h-8 rounded-lg object-contain"
                          />
                        )}
                        {brandName && (
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {brandName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{t("branding.previewHint")}</p>
                    </div>
                  </div>
                )}

                {/* Save */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleSaveBranding}
                    disabled={brandingSaving}
                    className="btn-primary gap-2"
                  >
                    {brandingSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {t("branding.save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SETTINGS ────────────────────────────────── */}
        {tab === "settings" && (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-brand-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("settings.emailPreferences")}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.emailPreferencesDesc")}</p>
                </div>
              </div>

              {emailPrefLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-3">
                      <Bell className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">{t("settings.notificationEmails")}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("settings.notificationEmailsDesc")}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const next = !emailNotifications;
                        setEmailNotifications(next);
                        saveEmailPreferences(next, emailMarketing);
                      }}
                      disabled={emailPrefSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${emailNotifications ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailNotifications ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-3">
                      <Megaphone className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">{t("settings.marketingEmails")}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("settings.marketingEmailsDesc")}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const next = !emailMarketing;
                        setEmailMarketing(next);
                        saveEmailPreferences(emailNotifications, next);
                      }}
                      disabled={emailPrefSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${emailMarketing ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailMarketing ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>

                  {emailPrefSaving && (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t("settings.saving")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SUPPORT ─────────────────────────────────── */}
        {tab === "support" && (
          <div className="space-y-6">
            {isAdmin ? (
              /* ═══════════════════════════════════════════════
                 ADMIN SUPPORT PANEL
                 ═══════════════════════════════════════════════ */
              ticketView === "detail" && selectedTicket ? (
                /* ── Admin Ticket Detail ─────────────────────── */
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setTicketView("list"); setSelectedTicket(null); }} className="btn-ghost p-2">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{selectedTicket.subject}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <TicketStatusBadge status={selectedTicket.status} t={t} />
                        <PriorityDot priority={selectedTicket.priority} />
                        <span className="text-xs text-gray-400">
                          {new Date(selectedTicket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Admin: user info card */}
                  <div className="card px-4 py-3 flex items-center gap-3 bg-gray-50 dark:bg-gray-800/40">
                    {selectedTicket.user.image ? (
                      <img src={selectedTicket.user.image} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-500">
                        {(selectedTicket.user.name || selectedTicket.user.email)?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedTicket.user.name || selectedTicket.user.email}</p>
                      <p className="text-xs text-gray-400">{selectedTicket.user.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedTicket.user.subscription === "ENTERPRISE" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                      selectedTicket.user.subscription === "PRO" ? "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400" :
                      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {selectedTicket.user.subscription}
                    </span>
                  </div>

                  {/* Admin: status action bar */}
                  <div className="flex gap-2 flex-wrap">
                    {selectedTicket.status !== "IN_PROGRESS" && selectedTicket.status !== "CLOSED" && (
                      <button onClick={() => handleTicketStatus(selectedTicket.id, "IN_PROGRESS")} className="btn-secondary text-sm gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {t("support.markInProgress")}
                      </button>
                    )}
                    {selectedTicket.status !== "RESOLVED" && selectedTicket.status !== "CLOSED" && (
                      <button onClick={() => handleTicketStatus(selectedTicket.id, "RESOLVED")} className="btn-secondary text-sm gap-1.5 !border-emerald-300 !text-emerald-600 hover:!bg-emerald-50 dark:hover:!bg-emerald-900/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("support.markResolved")}
                      </button>
                    )}
                    {selectedTicket.status !== "CLOSED" ? (
                      <button onClick={() => handleTicketStatus(selectedTicket.id, "CLOSED")} className="btn-ghost text-sm gap-1.5 text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20">
                        <X className="w-3.5 h-3.5" />
                        {t("support.closeTicket")}
                      </button>
                    ) : (
                      <button onClick={() => handleTicketStatus(selectedTicket.id, "OPEN")} className="btn-secondary text-sm gap-1.5">
                        {t("support.reopenTicket")}
                      </button>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="card overflow-hidden">
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedTicket.messages.map((msg) => (
                        <div key={msg.id} className={`p-4 ${msg.isAdmin ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {msg.user.image ? (
                              <img src={msg.user.image} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                {(msg.user.name || msg.user.email)?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-medium">{msg.user.name || msg.user.email}</span>
                            {msg.isAdmin && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                                {t("support.adminBadge")}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">{new Date(msg.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-8">{msg.body}</p>
                        </div>
                      ))}
                    </div>

                    {selectedTicket.status !== "CLOSED" && (
                      <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                        <div className="flex gap-3">
                          <textarea
                            value={ticketReply}
                            onChange={(e) => setTicketReply(e.target.value)}
                            rows={3}
                            className="input-field flex-1 resize-none"
                            placeholder={t("support.replyPlaceholder")}
                          />
                          <div className="flex flex-col gap-2 self-end shrink-0">
                            <button
                              onClick={handleTicketReply}
                              disabled={replySubmitting || !ticketReply.trim()}
                              className="btn-primary gap-2"
                            >
                              {replySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              {t("support.sendReply")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Admin Ticket List ───────────────────────── */
                <div>
                  {/* Admin header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{t("support.adminPanel")}</h3>
                      <p className="text-xs text-gray-400">{t("support.adminPanelDesc")}</p>
                    </div>
                  </div>

                  {/* Stats cards */}
                  {(() => {
                    const openCount = tickets.filter((t) => t.status === "OPEN").length;
                    const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
                    const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;
                    const closedCount = tickets.filter((t) => t.status === "CLOSED").length;
                    return (
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                        <button onClick={() => setAdminStatusFilter("ALL")} className={`card p-3 text-center transition-all ${adminStatusFilter === "ALL" ? "!border-brand-500 ring-2 ring-brand-500/20" : "hover:border-gray-300 dark:hover:border-gray-600"}`}>
                          <p className="text-2xl font-bold">{tickets.length}</p>
                          <p className="text-xs text-gray-500">{t("support.totalTickets")}</p>
                        </button>
                        <button onClick={() => setAdminStatusFilter("OPEN")} className={`card p-3 text-center transition-all ${adminStatusFilter === "OPEN" ? "!border-blue-500 ring-2 ring-blue-500/20" : "hover:border-gray-300 dark:hover:border-gray-600"}`}>
                          <p className="text-2xl font-bold text-blue-600">{openCount}</p>
                          <p className="text-xs text-gray-500">{t("support.openTickets")}</p>
                        </button>
                        <button onClick={() => setAdminStatusFilter("IN_PROGRESS")} className={`card p-3 text-center transition-all ${adminStatusFilter === "IN_PROGRESS" ? "!border-amber-500 ring-2 ring-amber-500/20" : "hover:border-gray-300 dark:hover:border-gray-600"}`}>
                          <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
                          <p className="text-xs text-gray-500">{t("support.inProgressTickets")}</p>
                        </button>
                        <button onClick={() => setAdminStatusFilter("RESOLVED")} className={`card p-3 text-center transition-all ${adminStatusFilter === "RESOLVED" ? "!border-emerald-500 ring-2 ring-emerald-500/20" : "hover:border-gray-300 dark:hover:border-gray-600"}`}>
                          <p className="text-2xl font-bold text-emerald-600">{resolvedCount}</p>
                          <p className="text-xs text-gray-500">{t("support.resolvedTickets")}</p>
                        </button>
                        <button onClick={() => setAdminStatusFilter("CLOSED")} className={`card p-3 text-center transition-all ${adminStatusFilter === "CLOSED" ? "!border-gray-500 ring-2 ring-gray-500/20" : "hover:border-gray-300 dark:hover:border-gray-600"}`}>
                          <p className="text-2xl font-bold text-gray-500">{closedCount}</p>
                          <p className="text-xs text-gray-500">{t("support.closedTickets")}</p>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Ticket list */}
                  {ticketsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => <div key={i} className="card h-24 animate-pulse bg-gray-100 dark:bg-gray-800" />)}
                    </div>
                  ) : (() => {
                    const filtered = adminStatusFilter === "ALL" ? tickets : tickets.filter((t) => t.status === adminStatusFilter);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-16">
                          <MessageSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                          <h3 className="text-lg font-semibold text-gray-500">{adminStatusFilter === "ALL" ? t("support.noTickets") : t("support.noTicketsForFilter")}</h3>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {filtered.map((ticket) => {
                          const lastMsg = ticket.messages?.[0];
                          const lastMsgIsUser = lastMsg && !lastMsg.isAdmin;
                          return (
                            <div key={ticket.id} className="card px-4 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <button onClick={() => fetchTicketDetail(ticket.id)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
                                <CircleDot className={`w-4 h-4 shrink-0 ${
                                  ticket.status === "OPEN" ? "text-blue-500" :
                                  ticket.status === "IN_PROGRESS" ? "text-amber-500" :
                                  ticket.status === "RESOLVED" ? "text-emerald-500" :
                                  "text-gray-400"
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate text-sm">{ticket.subject}</p>
                                    <TicketStatusBadge status={ticket.status} t={t} />
                                    <PriorityDot priority={ticket.priority} />
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{ticket.user.name || ticket.user.email}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                      ticket.user.subscription === "ENTERPRISE" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                                      ticket.user.subscription === "PRO" ? "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400" :
                                      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                    }`}>{ticket.user.subscription}</span>
                                    <span className="text-xs text-gray-400">
                                      {t("support.lastUpdated", { date: new Date(ticket.updatedAt).toLocaleDateString() })}
                                    </span>
                                    {ticket._count && (
                                      <span className="text-xs text-gray-400">· {t("support.messages", { count: String(ticket._count.messages) })}</span>
                                    )}
                                    {lastMsgIsUser && (
                                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{t("support.awaitingReply")}</span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                              </button>
                              {ticket.status !== "CLOSED" && (
                                <div className="flex gap-1.5 shrink-0 border-l border-gray-100 dark:border-gray-800 pl-3">
                                  {ticket.status !== "RESOLVED" && (
                                    <button
                                      onClick={() => handleTicketStatus(ticket.id, "RESOLVED")}
                                      title={t("support.quickResolve")}
                                      className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleTicketStatus(ticket.id, "CLOSED")}
                                    title={t("support.quickClose")}
                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )
            ) : !canUseTickets ? (
              /* ═══════════════════════════════════════════════
                 FREE / STARTER — EMAIL ONLY
                 ═══════════════════════════════════════════════ */
              <>
                <div className="card p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-brand-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{t("support.emailSupportTitle")}</h3>
                      <p className="text-sm text-gray-500 mt-1">{t("support.emailSupportDesc")}</p>
                      <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-primary mt-4 inline-flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {t("support.sendEmail")}
                      </a>
                      <p className="text-xs text-gray-400 mt-2">{SUPPORT_EMAIL}</p>
                    </div>
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <Crown className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-purple-700 dark:text-purple-300">{t("support.upgradeForTickets")}</p>
                      <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">{t("support.upgradeForTicketsDesc")}</p>
                      <button
                        onClick={() => { setTab("credits"); router.replace({ query: { tab: "credits" } }, undefined, { shallow: true }); }}
                        className="btn-primary mt-3 text-sm"
                      >
                        {t("common.viewPlans")}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : ticketView === "new" ? (
              /* ═══════════════════════════════════════════════
                 PRO / ENTERPRISE USER — NEW TICKET
                 ═══════════════════════════════════════════════ */
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setTicketView("list")} className="btn-ghost p-2">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="font-semibold text-lg">{t("support.newTicket")}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{t("support.subject")}</label>
                    <input
                      type="text"
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      className="input-field"
                      placeholder={t("support.subjectPlaceholder")}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{t("support.priority")}</label>
                    <div className="flex gap-2">
                      {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setNewTicketPriority(p)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                            newTicketPriority === p
                              ? p === "HIGH"
                                ? "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600"
                                : p === "LOW"
                                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
                                  : "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {t(`support.priority${p.charAt(0) + p.slice(1).toLowerCase()}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">{t("support.message")}</label>
                    <textarea
                      value={newTicketBody}
                      onChange={(e) => setNewTicketBody(e.target.value)}
                      rows={6}
                      className="input-field resize-none"
                      placeholder={t("support.messagePlaceholder")}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleCreateTicket}
                      disabled={ticketSubmitting || !newTicketSubject.trim() || !newTicketBody.trim()}
                      className="btn-primary gap-2"
                    >
                      {ticketSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {ticketSubmitting ? t("support.creating") : t("support.createTicket")}
                    </button>
                  </div>
                </div>
              </div>
            ) : ticketView === "detail" && selectedTicket ? (
              /* ═══════════════════════════════════════════════
                 PRO / ENTERPRISE USER — TICKET DETAIL
                 ═══════════════════════════════════════════════ */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setTicketView("list"); setSelectedTicket(null); }} className="btn-ghost p-2">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">{selectedTicket.subject}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TicketStatusBadge status={selectedTicket.status} t={t} />
                      <span className="text-xs text-gray-400">{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {selectedTicket.status !== "CLOSED" ? (
                    <button
                      onClick={() => handleTicketStatus(selectedTicket.id, "CLOSED")}
                      className="btn-ghost text-sm gap-1.5 text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t("support.closeTicket")}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTicketStatus(selectedTicket.id, "OPEN")}
                      className="btn-secondary text-sm gap-1.5 shrink-0"
                    >
                      {t("support.reopenTicket")}
                    </button>
                  )}
                </div>

                <div className="card overflow-hidden">
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {selectedTicket.messages.map((msg) => (
                      <div key={msg.id} className={`p-4 ${msg.isAdmin ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {msg.user.image ? (
                            <img src={msg.user.image} alt="" className="w-6 h-6 rounded-full" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500">
                              {(msg.user.name || msg.user.email)?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium">{msg.user.name || msg.user.email}</span>
                          {msg.isAdmin && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                              {t("support.adminBadge")}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-8">{msg.body}</p>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.status !== "CLOSED" && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex gap-3">
                        <textarea
                          value={ticketReply}
                          onChange={(e) => setTicketReply(e.target.value)}
                          rows={2}
                          className="input-field flex-1 resize-none"
                          placeholder={t("support.replyPlaceholder")}
                        />
                        <button
                          onClick={handleTicketReply}
                          disabled={replySubmitting || !ticketReply.trim()}
                          className="btn-primary self-end gap-2 shrink-0"
                        >
                          {replySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {t("support.sendReply")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ═══════════════════════════════════════════════
                 PRO / ENTERPRISE USER — TICKET LIST
                 ═══════════════════════════════════════════════ */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <LifeBuoy className="w-5 h-5" />
                    {t("support.myTickets")}
                  </h3>
                  <button onClick={() => setTicketView("new")} className="btn-primary gap-2">
                    <Plus className="w-4 h-4" />
                    {t("support.newTicket")}
                  </button>
                </div>

                <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {t("support.emailAlsoAvailable")} — <a href={`mailto:${SUPPORT_EMAIL}`} className="underline font-medium">{SUPPORT_EMAIL}</a>
                  </p>
                </div>

                {ticketsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-gray-100 dark:bg-gray-800" />)}
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-16">
                    <MessageSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-500">{t("support.noTickets")}</h3>
                    <p className="text-sm text-gray-400 mt-1 mb-5">{t("support.noTicketsDesc")}</p>
                    <button onClick={() => setTicketView("new")} className="btn-primary gap-2 inline-flex">
                      <Plus className="w-4 h-4" />
                      {t("support.newTicket")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => {
                      const lastMsg = ticket.messages?.[0];
                      return (
                        <button
                          key={ticket.id}
                          onClick={() => fetchTicketDetail(ticket.id)}
                          className="card px-4 py-3 w-full text-left flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <CircleDot className={`w-4 h-4 shrink-0 ${
                            ticket.status === "OPEN" ? "text-blue-500" :
                            ticket.status === "IN_PROGRESS" ? "text-amber-500" :
                            ticket.status === "RESOLVED" ? "text-emerald-500" :
                            "text-gray-400"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate text-sm">{ticket.subject}</p>
                              <TicketStatusBadge status={ticket.status} t={t} />
                              <PriorityDot priority={ticket.priority} />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">
                                {t("support.lastUpdated", { date: new Date(ticket.updatedAt).toLocaleDateString() })}
                              </span>
                              {ticket._count && (
                                <span className="text-xs text-gray-400">· {t("support.messages", { count: String(ticket._count.messages) })}</span>
                              )}
                              {lastMsg && (
                                <span className="text-xs text-gray-400 truncate max-w-[200px]">
                                  · {lastMsg.body.slice(0, 60)}{lastMsg.body.length > 60 ? "…" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function TicketStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    IN_PROGRESS: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    RESOLVED: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  const labels: Record<string, string> = {
    OPEN: t("support.statusOpen"),
    IN_PROGRESS: t("support.statusInProgress"),
    RESOLVED: t("support.statusResolved"),
    CLOSED: t("support.statusClosed"),
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config[status] || config.OPEN}`}>
      {labels[status] || status}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color = priority === "HIGH" ? "bg-red-500" : priority === "LOW" ? "bg-emerald-500" : "bg-amber-500";
  return <span className={`w-2 h-2 rounded-full ${color} shrink-0`} title={priority} />;
}
