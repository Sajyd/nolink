/**
 * Page d'édition d'un plan — Formulaire pour modifier nom, prix, features, badge Meilleur choix.
 */
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  amount: number;
  interval: string | null;
  features: string[];
  isBestChoice: boolean;
  partner: { id: string; name: string };
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

  const plan = await prisma.plan.findUnique({
    where: { id },
    include: { partner: true },
  });
  if (!plan || plan.partner.userId !== session.user?.id) return { notFound: true };

  return {
    props: {
      plan: {
        id: plan.id,
        name: plan.name,
        amount: plan.amount,
        interval: plan.interval,
        features: (plan.features as string[] | null) ?? [],
        isBestChoice: plan.isBestChoice ?? false,
        partner: { id: plan.partner.id, name: plan.partner.name },
      },
    },
  };
};

export default function PlanEditPage({ plan: initial }: { plan: Plan }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState(initial.amount / 100);
  const [interval, setInterval] = useState<"month" | "year">(
    (initial.interval as "month" | "year") ?? "month"
  );
  const [features, setFeatures] = useState(initial.features.join("\n"));
  const [isBestChoice, setIsBestChoice] = useState(initial.isBestChoice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/partner/update-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: initial.id,
          partnerId: initial.partner.id,
          name: name.trim(),
          amount: Math.round(amount * 100),
          interval: amount > 0 ? interval : null,
          features: features.split("\n").map((f) => f.trim()).filter(Boolean),
          isBestChoice,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/partner/${initial.partner.id}`);
        return;
      }
      setError(data.error ?? "Erreur");
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pt-20 pb-12">
        <div className="mx-auto max-w-xl">
          <Link href={`/partner/${initial.partner.id}`} className="text-sm text-primary-600 hover:underline">
            ← Retour à {initial.partner.name}
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-primary-900">Modifier le plan</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-surface-200 bg-white p-6 shadow-soft">
            {error && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-primary-800">Nom *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
                placeholder="Pro"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Prix (€)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
              />
            </div>
            {amount > 0 && (
              <div>
                <label className="block text-sm font-medium text-primary-800">Fréquence</label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as "month" | "year")}
                  className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
                >
                  <option value="month">Mensuel</option>
                  <option value="year">Annuel</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-primary-800">Features (une par ligne)</label>
              <textarea
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isBestChoice}
                onChange={(e) => setIsBestChoice(e.target.checked)}
              />
              Badge &quot;Meilleur choix&quot;
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
            >
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
