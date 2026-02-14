/**
 * Dashboard SaaS Nolink — Sections : Accueil, Mes services, Intégration, Analytics.
 */
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useState, useEffect } from "react";

type Service = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  stripeAccountId: string | null;
  plans: { id: string; name: string; amount: number }[];
};

type Analytics = {
  servicesCount: number;
  activeSubscriptions: number;
  totalRevenue: number;
  revenueShare: number;
};

type Tab = "accueil" | "services" | "integration" | "analytics";

export const getServerSideProps = async (
  context: import("next").GetServerSidePropsContext
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/auth/signin?callbackUrl=/partner", permanent: false } };
  }
  return { props: {} };
};

const BASE = typeof window !== "undefined" ? window.location.origin : process.env.NEXTAUTH_URL ?? "https://nolink.ai";

export default function PartnerDashboard() {
  const [tab, setTab] = useState<Tab>("accueil");
  const [services, setServices] = useState<Service[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Service[]>([]);

  useEffect(() => {
    fetch("/api/partner/services")
      .then((r) => r.json())
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/partner/analytics")
      .then((r) => r.json())
      .then(setAnalytics)
      .catch(() => setAnalytics(null));
  }, []);

  useEffect(() => {
    if (tab === "analytics" && services.length > 0 && !recommendations.length) {
      const slug = services[0]?.slug ?? "";
      if (slug)
        fetch(`/api/ai/recommend?slug=${encodeURIComponent(slug)}`)
          .then((r) => r.json())
          .then(setRecommendations)
          .catch(() => setRecommendations([]));
    }
  }, [tab, services, recommendations.length]);

  const selectedService = services.find((s) => s.slug === selectedSlug) ?? services[0];
  const snippetHtml = selectedService
    ? `<script src="${BASE}/widget.js" data-slug="${selectedService.slug}"></script>`
    : "// Sélectionnez un service";
  const embedUrl = selectedService ? `${BASE}/s/${selectedService.slug}?embed=1` : "";

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pt-20 pb-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-primary-900">Dashboard SaaS</h1>
            <Link
              href="/partner/new"
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-500"
            >
              Créer un SaaS
            </Link>
          </div>
          <p className="mt-1 text-muted">Gérez vos services, plans et intégrez le SDK Nolink.ai</p>

          <nav className="mt-6 flex gap-1 rounded-lg bg-surface-100 p-1">
            {(["accueil", "services", "integration", "analytics"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  tab === t
                    ? "bg-white text-primary-900 shadow-sm"
                    : "text-muted hover:text-primary-800"
                }`}
              >
                {t === "accueil" && "Accueil"}
                {t === "services" && "Mes services"}
                {t === "integration" && "Intégration"}
                {t === "analytics" && "Analytics"}
              </button>
            ))}
          </nav>

          {tab === "accueil" && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-primary-900">Résumé</h2>
              {loading ? (
                <p className="mt-4 text-muted">Chargement…</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
                    <p className="text-sm text-muted">Services</p>
                    <p className="mt-1 text-2xl font-bold text-primary-900">
                      {analytics?.servicesCount ?? services.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
                    <p className="text-sm text-muted">Utilisateurs actifs</p>
                    <p className="mt-1 text-2xl font-bold text-primary-900">
                      {analytics?.activeSubscriptions ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
                    <p className="text-sm text-muted">Conversion</p>
                    <p className="mt-1 text-2xl font-bold text-primary-900">
                      {services.length > 0 ? `${Math.round(((analytics?.activeSubscriptions ?? 0) / Math.max(services.length, 1)) * 100)}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
                    <p className="text-sm text-muted">Revenue partagé</p>
                    <p className="mt-1 text-2xl font-bold text-primary-900">
                      €{((analytics?.revenueShare ?? 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-6">
                <Link
                  href="/partner/new"
                  className="inline-flex items-center gap-2 text-primary-600 hover:underline"
                >
                  Ajouter un service →
                </Link>
              </div>
            </section>
          )}

          {tab === "services" && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-primary-900">Mes services</h2>
              {loading ? (
                <p className="mt-4 text-muted">Chargement…</p>
              ) : services.length === 0 ? (
                <div className="mt-6 rounded-xl border border-surface-200 bg-white p-8 text-center shadow-soft">
                  <p className="text-muted">Aucun SaaS pour l&apos;instant.</p>
                  <Link
                    href="/partner/new"
                    className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
                  >
                    Créer mon premier SaaS
                  </Link>
                </div>
              ) : (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {services.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/partner/${s.id}`}
                        className="block rounded-xl border border-surface-200 bg-white p-5 shadow-soft transition hover:shadow-glow"
                      >
                        {s.logoUrl && (
                          <img src={s.logoUrl} alt="" className="h-10 w-auto object-contain" />
                        )}
                        <h3 className="mt-3 font-semibold text-primary-900">{s.name}</h3>
                        <p className="mt-1 text-sm text-muted">{s.description || s.slug}</p>
                        <p className="mt-2 text-xs text-muted">
                          {s.plans.length} plan(s) · Stripe {s.stripeAccountId ? "connecté" : "non connecté"}
                        </p>
                        <span className="mt-3 inline-block text-sm font-medium text-primary-600">
                          Modifier / Ajouter plan →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === "integration" && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-primary-900">Intégration SDK</h2>
              <p className="mt-1 text-sm text-muted">
                Copiez le snippet ci-dessous pour afficher le bouton &quot;Accès immédiat&quot; sur votre site.
              </p>
              {services.length > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-primary-800">Service</label>
                  <select
                    value={selectedSlug ?? selectedService?.slug ?? ""}
                    onChange={(e) => setSelectedSlug(e.target.value || null)}
                    className="mt-1 rounded-lg border border-surface-200 px-3 py-2 text-sm"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-800">Option A — Script</label>
                  <div className="relative mt-1">
                    <pre className="overflow-x-auto rounded-lg bg-surface-100 p-3 text-xs text-primary-900">
                      {snippetHtml}
                    </pre>
                    <button
                      type="button"
                      onClick={() => copy(snippetHtml)}
                      className="absolute right-2 top-2 rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-500"
                    >
                      Copier
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-800">Option B — iframe</label>
                  <div className="relative mt-1">
                    <pre className="overflow-x-auto rounded-lg bg-surface-100 p-3 text-xs text-primary-900">
                      {`<iframe src="${embedUrl}" title="${selectedService?.name ?? "Nolink"}" width="100%" height="500" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`}
                    </pre>
                    <button
                      type="button"
                      onClick={() =>
                        copy(
                          `<iframe src="${embedUrl}" title="${selectedService?.name ?? "Nolink"}" width="100%" height="500" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`
                        )
                      }
                      className="absolute right-2 top-2 rounded bg-primary-600 px-2 py-1 text-xs text-white hover:bg-primary-500"
                    >
                      Copier
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted">
                Preview : <Link href={embedUrl || "#"} className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">Ouvrir en nouvel onglet</Link>
              </p>
            </section>
          )}

          {tab === "analytics" && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-primary-900">Analytics</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
                  <p className="text-sm text-muted">Abonnements</p>
                  <p className="mt-1 text-2xl font-bold text-primary-900">
                    {analytics?.activeSubscriptions ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
                  <p className="text-sm text-muted">Revenus (€)</p>
                  <p className="mt-1 text-2xl font-bold text-primary-900">
                    {((analytics?.totalRevenue ?? 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
              {recommendations.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-primary-800">Recommandations AI</h3>
                  <p className="mt-1 text-sm text-muted">SaaS complémentaires suggérés pour vos utilisateurs</p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {recommendations.slice(0, 4).map((s) => (
                      <li
                        key={s.id}
                        className="rounded-lg border border-surface-200 bg-surface-50/50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-primary-900">{s.name}</span>
                        <span className="ml-1 text-muted">— {s.plans.length} plan(s)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
