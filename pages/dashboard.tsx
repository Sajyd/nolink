import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import ServiceCard from "@/components/ServiceCard";
import { useState, useEffect } from "react";
import type { Session } from "next-auth";

type SubscriptionProp = {
  status: string | null;
  current_period_end: string | null;
} | null;

type DashboardProps = {
  session: Session;
  subscription: SubscriptionProp;
};

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/", permanent: false } };
  }
  const userId = session.user?.id;
  let subscription: SubscriptionProp = null;
  if (userId) {
    const sub = await prisma.subscription.findFirst({
      where: { userId, status: "active" },
      select: { status: true, currentPeriodEnd: true },
    });
    subscription = sub
      ? { status: sub.status, current_period_end: sub.currentPeriodEnd?.toISOString() ?? null }
      : null;
  }
  return { props: { session, subscription } };
};

type Service = { id: string; name: string; description: string; slug?: string; url?: string };

export default function Dashboard({ session, subscription }: DashboardProps) {
  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  const isPro = subscription?.status === "active";
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("fr-FR")
    : null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pt-20 pb-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">Accédez à vos SaaS en un clic.</p>

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700">Abonnement</h2>
            <p className="mt-1 text-sm text-gray-600">
              Statut : <strong>{isPro ? "Pro" : "Freemium"}</strong>
              {renewalDate && isPro && ` · Renouvellement : ${renewalDate}`}
            </p>
            {!isPro && (
              <form action="/api/stripe-checkout" method="POST" className="mt-3">
                <button
                  type="submit"
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Passer Pro (19€/mois)
                </button>
              </form>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-700">Services</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
