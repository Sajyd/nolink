/**
 * Page réinitialisation mot de passe : token en query, formulaire nouveau mot de passe.
 */

import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

export default function ResetPassword() {
  const router = useRouter();
  const token = router.query.token as string | undefined;
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Lien invalide.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/auth/signin"), 2000);
      } else {
        setError((data as { error?: string }).error ?? "Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token && router.isReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-gray-600">Lien invalide ou expiré.</p>
          <Link href="/auth/forgot-password" className="mt-4 inline-block font-medium text-gray-900 hover:underline">
            Redemander un lien
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-xl font-semibold text-gray-900">
          nolink.ai
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-center text-lg font-semibold text-gray-900">
            Nouveau mot de passe
          </h1>
          {success ? (
            <p className="mt-4 text-center text-sm text-green-600">
              Mot de passe mis à jour. Redirection…
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
                  type="password"
                  placeholder="Nouveau mot de passe (min. 8 caractères)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {loading ? "Enregistrement…" : "Enregistrer"}
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
