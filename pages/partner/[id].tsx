/**
 * Détail SaaS partenaire : éditer infos, créer plan, Stripe Connect, code d'intégration (widget + iframe).
 */
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

type Plan = {
  id: string;
  name: string;
  amount: number;
  interval: string | null;
  stripePriceId: string | null;
  features: string[];
  isBestChoice?: boolean;
};

type Service = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  ctaLabel: string | null;
  description: string | null;
  url: string | null;
  callbackUrl: string | null;
  tags: string | null;
  stripeAccountId: string | null;
  plans: Plan[];
};

export const getServerSideProps = async (
  context: import("next").GetServerSidePropsContext
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/auth/signin?callbackUrl=/partner", permanent: false } };
  }
  const rawId = context.params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) return { notFound: true };

  const partner = await prisma.partner.findFirst({
    where: { id, userId: session.user.id },
    include: { plans: true },
  });
  if (!partner) return { notFound: true };

  const service: Service = {
    id: partner.id,
    name: partner.name,
    slug: partner.slug,
    logoUrl: partner.logoUrl,
    primaryColor: partner.primaryColor,
    ctaLabel: partner.ctaLabel,
    description: partner.description,
    url: partner.url,
    callbackUrl: partner.callbackUrl,
    tags: partner.tags,
    stripeAccountId: partner.stripeAccountId,
    plans: partner.plans.map((p) => ({
      id: p.id,
      name: p.name,
      amount: p.amount,
      interval: p.interval,
      stripePriceId: p.stripePriceId,
      features: (p.features as string[] | null) ?? [],
      isBestChoice: p.isBestChoice ?? false,
    })),
  };

  return { props: { service } };
};

const BASE = typeof window !== "undefined" ? window.location.origin : process.env.NEXTAUTH_URL ?? "https://nolink.ai";

export default function PartnerServiceDetail({ service: initial }: { service: Service }) {
  const router = useRouter();
  const [service, setService] = useState(initial);
  const [connectLoading, setConnectLoading] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planAmount, setPlanAmount] = useState(0);
  const [planInterval, setPlanInterval] = useState<"month" | "year">("month");
  const [planFeatures, setPlanFeatures] = useState("");
  const [planBestChoice, setPlanBestChoice] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [friction, setFriction] = useState<{
    conversionRate: string;
    abandonRate: string;
    suggestions: string;
  } | null>(null);
  const [frictionLoading, setFrictionLoading] = useState(false);

  useEffect(() => {
    setService(initial);
  }, [initial]);

  async function handleStripeConnect() {
    setConnectLoading(true);
    try {
      const res = await fetch(`/api/partner/connect-onboard?partnerId=${service.id}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.error) alert(data.error);
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planName.trim()) return;
    setPlanLoading(true);
    try {
      const features = planFeatures
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
      const res = await fetch("/api/partner/create-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: service.id,
          name: planName.trim(),
          amount: planAmount * 100,
          interval: planAmount > 0 ? planInterval : null,
          features: features.length ? features : undefined,
          isBestChoice: planBestChoice,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setService((s) => ({
          ...s,
          plans: [
            ...s.plans,
            {
              id: data.id,
              name: data.name,
              amount: data.amount,
              interval: data.interval,
              stripePriceId: data.stripePriceId,
              features: data.features ?? [],
              isBestChoice: data.isBestChoice ?? false,
            },
          ],
        }));
        setPlanName("");
        setPlanAmount(0);
        setPlanFeatures("");
        setPlanBestChoice(false);
      } else alert(data.error ?? "Erreur");
    } finally {
      setPlanLoading(false);
    }
  }

  function copy(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function loadFriction() {
    setFrictionLoading(true);
    try {
      const res = await fetch(`/api/ai/friction?partnerId=${service.id}`);
      const data = await res.json();
      if (res.ok)
        setFriction({
          conversionRate: data.conversionRate,
          abandonRate: data.abandonRate,
          suggestions: data.suggestions,
        });
    } catch {
      setFriction(null);
    } finally {
      setFrictionLoading(false);
    }
  }

  const embedUrl = `${BASE}/s/${service.slug}?embed=1`;
  const widgetSnippet = `<script src="${BASE}/widget.js" data-slug="${service.slug}"></script>`;
  const iframeSnippet = `<iframe src="${embedUrl}" title="${service.name}" width="100%" height="500" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pt-20 pb-12">
        <div className="mx-auto max-w-3xl">
          <Link href="/partner" className="text-sm text-primary-600 hover:underline">
            ← Dashboard partenaire
          </Link>
          <div className="mt-4 flex items-center gap-4">
            {service.logoUrl && (
              <img src={service.logoUrl} alt="" className="h-12 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-primary-900">{service.name}</h1>
              <p className="text-sm text-muted">/s/{service.slug}</p>
            </div>
          </div>

          <section className="mt-8 rounded-xl border border-surface-200 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-primary-900">Stripe Connect</h2>
            <p className="mt-1 text-sm text-muted">
              Connectez votre compte Stripe pour recevoir les paiements.
            </p>
            <button
              type="button"
              onClick={handleStripeConnect}
              disabled={connectLoading}
              className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
            >
              {service.stripeAccountId
                ? "Compte connecté · Reconfigurer"
                : connectLoading
                  ? "Chargement…"
                  : "Connecter Stripe"}
            </button>
          </section>

          <section className="mt-6 rounded-xl border border-surface-200 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-primary-900">Plans</h2>
            <ul className="mt-3 space-y-2">
              {service.plans.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-surface-200/80 bg-surface-50/50 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {p.isBestChoice && (
                      <span className="ml-2 rounded bg-primary-100 px-1.5 py-0.5 text-xs text-primary-700">
                        Meilleur choix
                      </span>
                    )}
                  </div>
                  <span className="text-muted">
                    {p.amount === 0 ? "Gratuit" : `€${(p.amount / 100).toFixed(2)}/${p.interval === "month" ? "mois" : "an"}`}
                  </span>
                  <Link
                    href={`/plans/${p.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    Modifier
                  </Link>
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddPlan} className="mt-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Nom du plan (Free, Pro, Premium)"
                  className="rounded-lg border border-surface-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={planAmount || ""}
                  onChange={(e) => setPlanAmount(Number(e.target.value) || 0)}
                  placeholder="Prix (€)"
                  className="w-24 rounded-lg border border-surface-200 px-3 py-2 text-sm"
                />
                {planAmount > 0 && (
                  <select
                    value={planInterval}
                    onChange={(e) => setPlanInterval(e.target.value as "month" | "year")}
                    className="rounded-lg border border-surface-200 px-3 py-2 text-sm"
                  >
                    <option value="month">/mois</option>
                    <option value="year">/an</option>
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={planBestChoice}
                    onChange={(e) => setPlanBestChoice(e.target.checked)}
                  />
                  Meilleur choix
                </label>
                <button
                  type="submit"
                  disabled={planLoading}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
                >
                  {planLoading ? "…" : "Ajouter"}
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted">Features (une par ligne)</label>
                <textarea
                  value={planFeatures}
                  onChange={(e) => setPlanFeatures(e.target.value)}
                  placeholder="Feature 1&#10;Feature 2"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
                />
              </div>
            </form>
          </section>

          <section className="mt-6 rounded-xl border border-surface-200 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-primary-900">Analyse friction (AI)</h2>
            <p className="mt-1 text-sm text-muted">
              Taux de conversion et abandon au checkout — suggestions d&apos;amélioration.
            </p>
            {!friction ? (
              <button
                type="button"
                onClick={loadFriction}
                disabled={frictionLoading}
                className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
              >
                {frictionLoading ? "Chargement…" : "Analyser"}
              </button>
            ) : (
              <div className="mt-3 rounded-lg bg-surface-50 p-4 text-sm">
                <p className="text-muted">
                  Conversion : {friction.conversionRate}% · Abandon : {friction.abandonRate}%
                </p>
                <p className="mt-2 text-primary-900">{friction.suggestions}</p>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-surface-200 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-primary-900">Intégration</h2>
            <p className="mt-1 text-sm text-muted">
              Option A — Widget JS : ajoutez ce script sur votre site.
            </p>
            <div className="relative mt-2">
              <pre className="overflow-x-auto rounded-lg bg-surface-100 p-3 text-xs text-primary-900">
                {widgetSnippet}
              </pre>
              <button
                type="button"
                onClick={() => copy(widgetSnippet, "widget")}
                className="absolute right-2 top-2 rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-500"
              >
                {copied === "widget" ? "Copié" : "Copier"}
              </button>
            </div>
            <p className="mt-4 text-sm text-muted">
              Option B — iframe : intégrez la page d&apos;abonnement.
            </p>
            <div className="relative mt-2">
              <pre className="overflow-x-auto rounded-lg bg-surface-100 p-3 text-xs text-primary-900">
                {iframeSnippet}
              </pre>
              <button
                type="button"
                onClick={() => copy(iframeSnippet, "iframe")}
                className="absolute right-2 top-2 rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-500"
              >
                {copied === "iframe" ? "Copié" : "Copier"}
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Après paiement ou login, un POST est envoyé vers votre callback avec : user_id,
              subscription_status, token (JWT). Vérifiez le token via GET{" "}
              {BASE}/api/access/verify?token=xxx
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
