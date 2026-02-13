import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <>
      <Navbar />
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-14">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/80 via-surface-50 to-primary-100/40"
          aria-hidden
        />
        <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-primary-900 sm:text-4xl md:text-5xl">
            Un seul compte Nolink, accès instantané à tous vos SaaS.
          </h1>
          <p className="mt-5 text-lg text-muted sm:text-xl">
            Connexion unique, paiement centralisé, accès en un clic.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {status === "loading" ? (
              <span className="rounded-xl bg-surface-200/60 px-5 py-2.5 text-sm font-medium text-muted">
                Chargement…
              </span>
            ) : session ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-medium text-white shadow-soft hover:bg-primary-500 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
              >
                Voir le dashboard
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-medium text-white shadow-soft hover:bg-primary-500 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
              >
                Se connecter (Google, GitHub ou compte Nolink)
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
