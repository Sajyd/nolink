/**
 * Page récupération mot de passe : formulaire email, envoi du lien de reset via API.
 */

import Link from "next/link";
import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
      } else {
        setError((data as { error?: string }).error ?? "Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-xl font-semibold text-gray-900">
          nolink.ai
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-center text-lg font-semibold text-gray-900">
            Mot de passe oublié
          </h1>
          <p className="mt-1 text-center text-sm text-gray-500">
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
          {sent ? (
            <p className="mt-4 text-center text-sm text-green-600">
              Si un compte existe, vous recevrez un email avec le lien.
            </p>
          ) : (
            <>
              {error && (
                <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {loading ? "Envoi…" : "Envoyer le lien"}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/auth/signin" className="font-medium text-gray-900 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
