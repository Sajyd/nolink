/**
 * Page d’abonnement SaaS par partenaire : /s/[slug]
 * Affiche logo, couleurs, description, features, plans (Freemium, Pro) et CTA "Accès immédiat".
 * Support ?embed=1 pour iframe (layout minimal). CTA : login si non connecté, sinon create-subscription ou dashboard.
 */

import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import PaymentModal from "@/components/PaymentModal";

type Plan = {
  id: string;
  name: string;
  amount: number;
  interval: string | null;
  stripePriceId: string | null;
  features: string[] | null;
  isBestChoice?: boolean;
};

type PartnerPageProps = {
  slug: string;
  embed: boolean;
  partner: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
    ctaLabel: string | null;
    description: string | null;
    features: string[] | null;
    url: string | null;
    plans: Plan[];
  } | null;
  session: { user?: { id: string } } | null;
};

export const getServerSideProps: GetServerSideProps<PartnerPageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  const slug = context.params?.slug as string;
  const embed = context.query?.embed === "1";

  const partner = await prisma.partner.findUnique({
    where: { slug },
    include: {
      plans: true,
    },
  });

  if (!partner) {
    return { notFound: true };
  }

  const plans: Plan[] = partner.plans.map((p) => ({
    id: p.id,
    name: p.name,
    amount: p.amount,
    interval: p.interval,
    stripePriceId: p.stripePriceId,
    features: (p.features as string[] | null) ?? [],
    isBestChoice: p.isBestChoice ?? false,
  }));

  return {
    props: {
      slug,
      embed: !!embed,
      partner: {
        id: partner.id,
        name: partner.name,
        slug: partner.slug,
        logoUrl: partner.logoUrl,
        primaryColor: partner.primaryColor,
        ctaLabel: partner.ctaLabel,
        description: partner.description,
        features: (partner.features as string[] | null) ?? [],
        url: partner.url,
        plans,
      },
      session: session ? { user: { id: session.user?.id } } : null,
    },
  };
};

export default function PartnerPage({ partner, embed, session }: PartnerPageProps) {
  const router = useRouter();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    planId: string;
    planName: string;
    amount: number;
    clientSecret?: string | null;
  } | null>(null);
  const returnUrl = (router.query.return_url as string) || undefined;

  if (!partner) return null;

  const primaryColor = partner.primaryColor ?? "#6366f1";

  async function handlePlanClick(planId: string, amount: number) {
    if (!partner) return;
    if (!session?.user?.id) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (amount === 0) {
      setLoadingPlanId(planId);
      try {
        const res = await fetch("/api/create-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId: partner.id,
            planId,
            ...(returnUrl && { return_url: returnUrl }),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        if (data.error) alert(data.error);
      } finally {
        setLoadingPlanId(null);
      }
      return;
    }
    setLoadingPlanId(planId);
    try {
      const res = await fetch("/api/payment/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: partner.id, planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.needSetupIntent) {
        const plan = partner.plans.find((p) => p.id === planId);
        setPaymentModal({
          planId,
          planName: plan?.name ?? "Pro",
          amount,
          clientSecret: undefined,
        });
        return;
      }
      if (data.status === "requires_action" && data.client_secret) {
        const plan = partner.plans.find((p) => p.id === planId);
        setPaymentModal({
          planId,
          planName: plan?.name ?? "Pro",
          amount,
          clientSecret: data.client_secret,
        });
        return;
      }
      if (data.status === "succeeded" && data.payment_intent_id) {
        let token: string | null = null;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const statusRes = await fetch(
            `/api/payment/status?payment_intent_id=${encodeURIComponent(data.payment_intent_id)}`
          );
          const statusData = await statusRes.json().catch(() => ({}));
          if (statusData.token) {
            token = statusData.token;
            break;
          }
        }
        if (token && returnUrl?.startsWith("http")) {
          window.location.href = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}nolink_token=${encodeURIComponent(token)}`;
          return;
        }
        if (token) {
          router.push("/dashboard?payment=success");
          return;
        }
      }
      if (data.error) alert(data.error);
    } finally {
      setLoadingPlanId(null);
    }
  }

  function handlePaymentSuccess(token: string) {
    setPaymentModal(null);
    if (returnUrl?.startsWith("http")) {
      window.location.href = `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}nolink_token=${encodeURIComponent(token)}`;
      return;
    }
    router.push("/dashboard?payment=success");
  }

  const content = (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-surface-200 bg-white p-8 shadow-soft">
        {partner.logoUrl && (
          <img
            src={partner.logoUrl}
            alt={partner.name}
            className="h-12 w-auto object-contain"
          />
        )}
        <h1 className="mt-4 text-2xl font-bold text-primary-900">{partner.name}</h1>
        {partner.description && (
          <p className="mt-2 text-muted">{partner.description}</p>
        )}
        {partner.features?.length ? (
          <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-muted">
            {partner.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {partner.plans.map((plan) => (
            <div
              key={plan.id}
              className="relative rounded-xl border border-surface-200 p-5"
              style={{ borderColor: plan.amount > 0 ? primaryColor : undefined }}
            >
              {plan.isBestChoice && (
                <span
                  className="absolute -top-2 right-4 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Meilleur choix
                </span>
              )}
              <h3 className="font-semibold text-primary-900">{plan.name}</h3>
              <p className="mt-1 text-2xl font-bold text-primary-900">
                {plan.amount === 0
                  ? "Gratuit"
                  : `€${(plan.amount / 100).toFixed(2)}${plan.interval === "month" ? "/mois" : plan.interval === "year" ? "/an" : ""}`}
              </p>
              {plan.features?.length ? (
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {plan.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={() => handlePlanClick(plan.id, plan.amount)}
                disabled={!!loadingPlanId}
                className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                style={{
                  backgroundColor: plan.amount > 0 ? primaryColor : "#374151",
                }}
              >
                {loadingPlanId === plan.id ? "Chargement…" : partner.ctaLabel ?? "Accès immédiat"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (embed) {
    return (
      <div style={{ backgroundColor: `${primaryColor}08` }} className="min-h-screen">
        {content}
        {paymentModal && (
          <PaymentModal
            open={!!paymentModal}
            onClose={() => setPaymentModal(null)}
            partnerId={partner.id}
            planId={paymentModal.planId}
            partnerName={partner.name}
            planName={paymentModal.planName}
            amount={paymentModal.amount}
            returnUrl={returnUrl}
            onSuccess={handlePaymentSuccess}
            paymentIntentClientSecret={paymentModal.clientSecret}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-14" style={{ backgroundColor: `${primaryColor}08` }}>
        {content}
      </main>
      {paymentModal && (
        <PaymentModal
          open={!!paymentModal}
          onClose={() => setPaymentModal(null)}
          partnerId={partner.id}
          planId={paymentModal.planId}
          partnerName={partner.name}
          planName={paymentModal.planName}
          amount={paymentModal.amount}
          returnUrl={returnUrl}
          onSuccess={handlePaymentSuccess}
          paymentIntentClientSecret={paymentModal.clientSecret}
        />
      )}
    </>
  );
}
