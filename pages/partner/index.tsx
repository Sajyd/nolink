/**
 * Dashboard partenaire : liste des SaaS, lien "Créer un SaaS", lien vers chaque SaaS.
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

export const getServerSideProps = async (
  context: import("next").GetServerSidePropsContext
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/auth/signin?callbackUrl=/partner", permanent: false } };
  }
  return { props: {} };
};

export default function PartnerDashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/services")
      .then((r) => r.json())
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pt-20 pb-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary-900">Dashboard Partenaire</h1>
            <Link
              href="/partner/new"
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-500"
            >
              Créer un SaaS
            </Link>
          </div>
          <p className="mt-1 text-muted">Gérez vos services et intégrez Nolink en quelques clics.</p>

          {loading ? (
            <p className="mt-8 text-muted">Chargement…</p>
          ) : services.length === 0 ? (
            <div className="mt-8 rounded-xl border border-surface-200 bg-white p-8 text-center shadow-soft">
              <p className="text-muted">Aucun SaaS pour l&apos;instant.</p>
              <Link
                href="/partner/new"
                className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
              >
                Créer mon premier SaaS
              </Link>
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/partner/${s.id}`}
                    className="block rounded-xl border border-surface-200 bg-white p-5 shadow-soft transition hover:shadow-glow"
                  >
                    {s.logoUrl && (
                      <img src={s.logoUrl} alt="" className="h-10 w-auto object-contain" />
                    )}
                    <h2 className="mt-3 font-semibold text-primary-900">{s.name}</h2>
                    <p className="mt-1 text-sm text-muted">{s.description || s.slug}</p>
                    <p className="mt-2 text-xs text-muted">
                      {s.plans.length} plan(s) · Stripe {s.stripeAccountId ? "connecté" : "non connecté"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
