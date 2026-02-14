/**
 * Carte partenaire SaaS : logo, description, prix, bouton "Accès immédiat".
 * Si 402 + needSubscription → redirection vers /s/[slug] (page abonnement).
 */
import { useState } from "react";
import { useRouter } from "next/router";

type Plan = {
  id: string;
  name: string;
  amount: number;
  interval: string | null;
};

type Service = {
  id: string;
  name: string;
  description: string;
  slug?: string;
  url?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  plans?: Plan[];
};

type Props = { service: Service };

function formatPrice(plan: Plan): string {
  if (plan.amount === 0) return "Gratuit";
  const suffix = plan.interval === "month" ? "/mois" : plan.interval === "year" ? "/an" : "";
  return `€${(plan.amount / 100).toFixed(2)}${suffix}`;
}

export default function ServiceCard({ service }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccess() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && data.needSubscription && data.slug) {
          router.push(`/s/${data.slug}`);
          return;
        }
        setError(data.error ?? "Limite atteinte. Passez Pro pour un accès illimité.");
        return;
      }
      if (data.url) window.open(data.url, "_blank");
    } catch {
      setError("Erreur d'accès.");
    } finally {
      setLoading(false);
    }
  }

  const priceLabel =
    service.plans?.length && service.plans[0]
      ? formatPrice(service.plans[0])
      : "";

  return (
    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-soft transition hover:shadow-glow">
      {service.logoUrl && (
        <img
          src={service.logoUrl}
          alt=""
          className="h-10 w-auto object-contain"
        />
      )}
      <h3 className="mt-3 text-lg font-semibold text-primary-900">{service.name}</h3>
      <p className="mt-1 text-sm text-muted">{service.description}</p>
      {priceLabel && (
        <p className="mt-2 text-sm font-medium text-primary-700">{priceLabel}</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-amber-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4">
        <button
          onClick={handleAccess}
          disabled={loading}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
        >
          {loading ? "Accès…" : "Accès immédiat"}
        </button>
      </div>
    </div>
  );
}
