/**
 * Carte partenaire SaaS : nom, description, bouton "Accès immédiat" qui appelle POST /api/access et ouvre l’URL du partenaire.
 */
import { useState } from "react";

type Service = {
  id: string;
  name: string;
  description: string;
  slug?: string;
  url?: string;
};

type Props = { service: Service };

export default function ServiceCard({ service }: Props) {
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
      <p className="mt-1 text-sm text-gray-600">{service.description}</p>
      {error && (
        <p className="mt-2 text-sm text-amber-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4">
        <button
          onClick={handleAccess}
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Accès…" : "Accès immédiat"}
        </button>
      </div>
    </div>
  );
}
