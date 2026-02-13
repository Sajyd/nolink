import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Erreur lors de l'inscription");
      return;
    }

    const signInRes = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });

    if (signInRes?.error) {
      router.push("/auth/signin?registered=1");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-xl font-semibold text-gray-900">
          nolink.ai
        </Link>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-center text-lg font-semibold text-gray-900">Créer un compte Nolink</h1>
          <p className="mt-1 text-center text-sm text-gray-500">
            Un seul compte pour tous vos SaaS
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Nom (optionnel)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              required
            />
            <input
              type="password"
              placeholder="Mot de passe (min. 8 caractères)"
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
              {loading ? "Création…" : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Déjà un compte ?{" "}
          <Link href="/auth/signin" className="font-medium text-gray-900 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
