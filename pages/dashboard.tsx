/**
 * Dashboard utilisateur : liste des SaaS, bouton Accès immédiat, historique des abonnements,
 * statistiques (nb abonnements, usage), lien Stripe Customer Portal pour gérer les paiements.
 */

import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import ServiceCard from "@/components/ServiceCard";
import { useState, useEffect } from "react";
import type { Session } from "next-auth";

type SubWithPartner = {
  id: string;
  status: string | null;
  currentPeriodEnd: string | null;
  partner: { name: string; slug: string } | null;
  plan: { name: string } | null;
};

type DashboardProps = {
  session: Session;
  subscriptions: SubWithPartner[];
  activeCount: number;
  usageToday: number;
};

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/", permanent: false } };
  }
  const userId = session.user?.id;
  if (!userId) {
    return { props: { session, subscriptions: [], activeCount: 0, usageToday: 0 } };
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    include: {
      partner: { select: { name: true, slug: true } },
      plan: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeCount = subscriptions.filter((s) => s.status === "active").length;

  const today = new Date().toISOString().slice(0, 10);
  const usageRow = await prisma.usage.findUnique({
    where: { userId_date: { userId, date: new Date(today) } },
  });
  const usageToday = usageRow?.count ?? 0;

  const serialized: SubWithPartner[] = subscriptions.map((s) => ({
    id: s.id,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    partner: s.partner,
    plan: s.plan,
  }));

  return {
    props: { session, subscriptions: serialized, activeCount, usageToday },
  };
};

type Service = {
  id: string;
  name: string;
  description: string;
  slug?: string;
  url?: string;
  plans?: { id: string; name: string; amount: number; interval: string | null }[];
};

export default function Dashboard({
  session,
  subscriptions,
  activeCount,
  usageToday,
}: DashboardProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [recommendations, setRecommendations] = useState<Service[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  useEffect(() => {
    if (services.length === 0) return;
    const slug = subscriptions.find((s) => s.partner?.slug)?.partner?.slug ?? services[0]?.slug;
    if (slug) {
      fetch(`/api/ai/recommend?slug=${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then(setRecommendations)
        .catch(() => setRecommendations([]));
    }
  }, [services, subscriptions]);

  async function handleManagePayments() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe-portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.error) alert(data.error);
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pt-20 pb-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold text-primary-900">Dashboard</h1>
          <p className="mt-1 text-muted">Accédez à vos SaaS en un clic.</p>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
              <h2 className="text-sm font-semibold text-primary-800">Statistiques</h2>
              <p className="mt-2 text-2xl font-semibold text-primary-900">{activeCount}</p>
              <p className="text-sm text-muted">abonnement(s) actif(s)</p>
              <p className="mt-2 text-2xl font-semibold text-primary-900">{usageToday}</p>
              <p className="text-sm text-muted">accès aujourd&apos;hui</p>
            </div>
            <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
              <h2 className="text-sm font-semibold text-primary-800">Paiement</h2>
              <button
                type="button"
                onClick={handleManagePayments}
                disabled={portalLoading}
                className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
              >
                {portalLoading ? "Chargement…" : "Gérer mes paiements"}
              </button>
            </div>
          </section>

          <section className="mt-8 rounded-xl border border-surface-200 bg-white p-4 shadow-soft">
            <h2 className="text-sm font-semibold text-primary-800">Mes abonnements</h2>
            {subscriptions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Aucun abonnement pour l’instant.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {subscriptions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-200/80 bg-surface-50/50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-primary-900">
                      {s.partner?.name ?? "Nolink"}
                    </span>
                    <span className="text-muted">
                      {s.status === "active" ? "Pro" : "Freemium"}
                      {s.plan?.name && ` · ${s.plan.name}`}
                    </span>
                    {s.currentPeriodEnd && s.status === "active" && (
                      <span className="text-muted">
                        Renouvellement :{" "}
                        {new Date(s.currentPeriodEnd).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-primary-800">Services</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          </section>

          {recommendations.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-primary-800">SaaS recommandés pour vous</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recommendations.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
