/**
 * Page de test / preview pour les partenaires SaaS : aperçu de l’implémentation
 * du bouton « Accès immédiat » (SDK, code snippets, flux retour + token).
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Navbar from "@/components/Navbar";

const DEFAULT_SLUG = "notion";
const DEFAULT_COLOR = "#6366f1";

export default function IntegratePage() {
  const router = useRouter();
  const [slug, setSlug] = useState(DEFAULT_SLUG);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [returnToken, setReturnToken] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);

  const tokenFromUrl =
    typeof router.query.nolink_token === "string" ? router.query.nolink_token : null;
  // Détection du retour avec token (simulation du handleReturnToken du SDK)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("nolink_token");
    if (token) {
      setReturnToken(token);
      // Optionnel : appeler l’API verify pour montrer le résultat
      const base = window.location.origin;
      fetch(`${base}/api/access/verify?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((data) => setVerifyResult(data))
        .catch(() => setVerifyResult({ error: "Échec vérification" }));
    }
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const returnUrl = typeof window !== "undefined" ? window.location.href.split("?")[0] : "";
  const accessUrl = `${baseUrl}/s/${encodeURIComponent(slug)}?embed=1&return_url=${encodeURIComponent(returnUrl)}`;

  const codeVanilla = `import { init, showAccessButton, onSubscriptionSuccess, handleReturnToken } from 'nolink-sdk';

init({
  partnerKey: '${slug}',
  baseUrl: '${baseUrl || "https://nolink.ai"}',
  primaryColor: '${color}'
});

onSubscriptionSuccess(({ userId, token, subscriptionStatus }) => {
  console.log('Accès accordé:', userId, subscriptionStatus);
  // Envoyer le token à votre backend, rediriger, etc.
});

handleReturnToken(); // À appeler au chargement de la page

showAccessButton('${slug}', {
  buttonText: 'Accès immédiat',
  color: '${color}',
  mountTarget: '#nolink-container'
});`;

  const codeReact = `import { init, handleReturnToken, onSubscriptionSuccess } from 'nolink-sdk';
// Si vous utilisez le build React du SDK : NolinkAccessButton depuis 'nolink-sdk/react'

init({ partnerKey: '${slug}', baseUrl: '${baseUrl || "https://nolink.ai"}', primaryColor: '${color}' });
onSubscriptionSuccess(({ userId, token }) => { /* ... */ });
handleReturnToken();

// Bouton : lien vers la page Nolink
<a href={\`${baseUrl || "https://nolink.ai"}/s/${slug}?embed=1&return_url=\${encodeURIComponent(window.location.href)}\`}
   style={{ backgroundColor: '${color}' }}>
  Accès immédiat
</a>`;

  const codeVerify = `// Après le retour avec ?nolink_token=xxx
const res = await fetch(
  \`${baseUrl || "https://nolink.ai"}/api/access/verify?token=\${token}\`
);
const data = await res.json();
// { user_id, partner_id, subscription_status: "active" | "freemium" }`;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 pt-14">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <h1 className="text-2xl font-bold text-gray-900">
            Intégration du bouton Accès
          </h1>
          <p className="mt-2 text-gray-600">
            Prévisualisez et copiez le code pour intégrer le bouton « Accès immédiat »
            sur votre SaaS. Le flux : clic → Nolink (login / paiement) → retour sur
            votre page avec un token JWT.
          </p>

          {/* Paramètres de preview */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Paramètres de test</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Slug partenaire (serviceId)
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.trim() || DEFAULT_SLUG)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="ex: notion, slack"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Couleur du bouton (hex)
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value || DEFAULT_COLOR)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  placeholder="#6366f1"
                />
              </div>
            </div>
          </div>

          {/* Aperçu du bouton */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Aperçu du bouton</h2>
            <p className="mt-1 text-sm text-gray-500">
              Clic → redirection vers la page Nolink du partenaire (login / choix de plan).
              Après paiement, retour ici avec le token dans l’URL.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a
                href={accessUrl}
                className="inline-flex rounded-lg px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                style={{ backgroundColor: color }}
              >
                Accès immédiat
              </a>
              <span className="text-sm text-gray-400">
                Lien : <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{accessUrl}</code>
              </span>
            </div>
          </div>

          {/* Retour avec token */}
          {(returnToken ?? tokenFromUrl) && (
            <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6">
              <h2 className="text-lg font-semibold text-green-900">
                Retour avec token (simulation réussie)
              </h2>
              <p className="mt-1 text-sm text-green-800">
                La page a été rechargée avec <code className="rounded bg-green-100 px-1">?nolink_token=...</code>.
                Dans votre app, appelez <code className="rounded bg-green-100 px-1">handleReturnToken()</code> au
                chargement puis vérifiez le token côté backend.
              </p>
              {verifyResult && (
                <pre className="mt-3 overflow-auto rounded-lg bg-white p-4 text-xs text-gray-800">
                  {JSON.stringify(verifyResult, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Snippets de code */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Code d’intégration (vanilla JS)</h2>
            <p className="mt-1 text-sm text-gray-500">
              Avec le SDK <code className="rounded bg-gray-100 px-1">nolink-sdk</code> : init, callbacks, bouton.
            </p>
            <pre className="mt-4 overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
              <code>{codeVanilla}</code>
            </pre>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(codeVanilla)}
              className="mt-2 rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
            >
              Copier
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Alternative : lien / React</h2>
            <p className="mt-1 text-sm text-gray-500">
              Sans SDK : un simple lien vers la page Nolink avec <code className="rounded bg-gray-100 px-1">return_url</code>.
            </p>
            <pre className="mt-4 overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
              <code>{codeReact}</code>
            </pre>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(codeReact)}
              className="mt-2 rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
            >
              Copier
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Vérifier le token (API)</h2>
            <p className="mt-1 text-sm text-gray-500">
              GET <code className="rounded bg-gray-100 px-1">/api/access/verify?token=xxx</code> pour obtenir{" "}
              <code className="rounded bg-gray-100 px-1">user_id</code>,{" "}
              <code className="rounded bg-gray-100 px-1">partner_id</code>,{" "}
              <code className="rounded bg-gray-100 px-1">subscription_status</code>.
            </p>
            <pre className="mt-4 overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
              <code>{codeVerify}</code>
            </pre>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(codeVerify)}
              className="mt-2 rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
            >
              Copier
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm text-gray-600">
            <Link href="/partner" className="font-medium text-indigo-600 hover:text-indigo-800">
              ← Espace partenaire
            </Link>
            <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-800">
              Accueil
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
