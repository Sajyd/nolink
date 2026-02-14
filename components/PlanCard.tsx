/**
 * Carte plan d'abonnement : nom, prix, features, badge "Meilleur choix", bouton CTA.
 */
type Plan = {
  id: string;
  name: string;
  amount: number;
  interval: string | null;
  features?: string[];
  isBestChoice?: boolean;
};

type Props = {
  plan: Plan;
  ctaLabel?: string;
  primaryColor?: string;
  loading?: boolean;
  onSelect: () => void;
};

function formatPrice(plan: Plan): string {
  if (plan.amount === 0) return "Gratuit";
  const suffix = plan.interval === "month" ? "/mois" : plan.interval === "year" ? "/an" : "";
  return `€${(plan.amount / 100).toFixed(2)}${suffix}`;
}

export default function PlanCard({ plan, ctaLabel = "Accès immédiat", primaryColor = "#6366f1", loading, onSelect }: Props) {
  return (
    <div
      className="relative rounded-xl border border-surface-200 p-5"
      style={{ borderColor: plan.amount > 0 ? primaryColor : undefined }}
    >
      {plan.isBestChoice && (
        <span
          className="absolute -top-2 right-4 rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Meilleur choix
        </span>
      )}
      <h3 className="font-semibold text-primary-900">{plan.name}</h3>
      <p className="mt-1 text-2xl font-bold text-primary-900">{formatPrice(plan)}</p>
      {plan.features?.length ? (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {plan.features.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        disabled={loading}
        className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: plan.amount > 0 ? primaryColor : "#374151" }}
      >
        {loading ? "Chargement…" : ctaLabel}
      </button>
    </div>
  );
}
