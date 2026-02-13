/**
 * Barre de navigation : logo nolink.ai, lien Dashboard et Déconnexion si connecté, Sinon lien Se connecter.
 */
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-10 border-b border-surface-200/80 bg-surface-50/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-semibold text-primary-900 hover:text-primary-700"
        >
          nolink.ai
        </Link>
        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <span className="text-sm text-muted">Chargement…</span>
          ) : session ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 hover:text-primary-900"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut()}
                className="rounded-lg bg-surface-200 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-surface-300 hover:text-primary-900"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
            >
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
