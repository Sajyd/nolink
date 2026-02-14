/**
 * Création d'un nouveau SaaS partenaire : nom, logo, URL, callback, description, couleurs.
 */
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

export const getServerSideProps = async (
  context: import("next").GetServerSidePropsContext
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/auth/signin?callbackUrl=/partner/new", permanent: false } };
  }
  return { props: {} };
};

export default function NewPartnerService() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    url: "",
    callbackUrl: "",
    description: "",
    primaryColor: "#6366f1",
    ctaLabel: "Accès immédiat",
    tags: "",
  });

  async function handleGenerateFromUrl() {
    const url = form.url?.trim();
    if (!url) {
      setError("Indiquez d'abord l'URL du service pour générer la description.");
      return;
    }
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok && (data.description || data.tags)) {
        setForm((f) => ({
          ...f,
          description: data.description || f.description,
          tags: data.tags || f.tags,
        }));
      }
    } catch {
      setError("Génération impossible.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/partner/create-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          logoUrl: form.logoUrl || undefined,
          url: form.url || undefined,
          callbackUrl: form.callbackUrl || undefined,
          description: form.description || undefined,
          primaryColor: form.primaryColor || undefined,
          ctaLabel: form.ctaLabel || undefined,
          tags: form.tags || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      router.push(`/partner/${data.id}`);
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
          <Link href="/partner" className="text-sm text-primary-600 hover:underline">
            ← Retour au dashboard partenaire
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-primary-900">Nouveau SaaS</h1>
          <p className="mt-1 text-muted">Renseignez les infos de votre service.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-surface-200 bg-white p-6 shadow-soft">
            {error && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-primary-800">Nom *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Mon SaaS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Slug (URL)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="mon-saas"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">URL du service</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="https://app.monsaas.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Endpoint callback (POST)</label>
              <input
                type="url"
                value={form.callbackUrl}
                onChange={(e) => setForm((f) => ({ ...f, callbackUrl: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="https://api.monsaas.com/nolink/callback"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Logo (URL)</label>
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Description</label>
              <button
                type="button"
                onClick={handleGenerateFromUrl}
                disabled={aiLoading || !form.url}
                className="mb-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
              >
                {aiLoading ? "Génération…" : "Générer depuis l'URL (AI)"}
              </button>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Description courte du SaaS"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Texte bouton CTA</label>
              <input
                type="text"
                value={form.ctaLabel}
                onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Accès immédiat"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Couleur principale</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="mt-1 h-10 w-full rounded border border-surface-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-800">Tags (catégories)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="productivity, collaboration"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-60"
            >
              {loading ? "Création…" : "Créer le SaaS"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
