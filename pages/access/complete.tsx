/**
 * /access/complete?return_url=xxx&slug=xxx
 * Page de redirection après paiement : récupère le token via /api/access et redirige vers return_url avec token.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function AccessComplete() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const returnUrl = router.query.return_url as string | undefined;
    const slug = router.query.slug as string | undefined;

    if (!returnUrl || !slug) {
      setError("Paramètres manquants");
      return;
    }

    async function complete() {
      try {
        const res = await fetch("/api/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ slug, return_url: returnUrl }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
        setError(data.error ?? "Erreur lors de l'accès");
      } catch {
        setError("Erreur réseau");
      }
    }

    complete();
  }, [router.query]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <a href="/dashboard" className="mt-4 inline-block text-sm text-gray-600 underline">
            Retour au dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        <p className="mt-4 text-gray-600">Redirection en cours…</p>
      </div>
    </div>
  );
}
