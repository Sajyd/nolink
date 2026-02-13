/**
 * Landing page nolink.ai
 * Tagline, CTA principal "Créer mon compte", secondaire "Se connecter", section Comment ça marche en 3 étapes.
 */

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useSession } from "next-auth/react";

const STEPS = [
  {
    title: "Créer un compte Nolink",
    description: "Inscrivez-vous en un clic avec votre email ou Google.",
    step: 1,
  },
  {
    title: "Choisir vos SaaS et payer en un endroit",
    description: "Un seul paiement Stripe pour tous vos abonnements.",
    step: 2,
  },
  {
    title: "Accès immédiat depuis votre dashboard",
    description: "Un bouton par SaaS, plus besoin de multiplier les logins.",
    step: 3,
  },
];

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden px-4 pt-14 pb-20">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/80 via-surface-50 to-primary-100/40"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-4xl">
          <section className="flex flex-col items-center py-16 text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-primary-900 sm:text-4xl md:text-5xl">
              Un seul compte Nolink, accès immédiat à tous vos SaaS.
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
                <>
                  <Link
                    href="/auth/register"
                    className="rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-medium text-white shadow-soft hover:bg-primary-500 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
                  >
                    Créer mon compte
                  </Link>
                  <Link
                    href="/auth/signin"
                    className="rounded-xl border border-primary-300 bg-white px-6 py-3.5 text-sm font-medium text-primary-700 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
                  >
                    Se connecter
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="border-t border-surface-200/80 pt-16">
            <h2 className="text-center text-2xl font-semibold text-primary-900">
              Comment ça marche
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map(({ title, description, step }) => (
                <div
                  key={step}
                  className="flex flex-col items-center rounded-2xl border border-surface-200/80 bg-white/80 p-6 text-center shadow-soft"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700"
                    aria-hidden
                  >
                    {step}
                  </span>
                  <h3 className="mt-4 font-semibold text-primary-900">{title}</h3>
                  <p className="mt-2 text-sm text-muted">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
