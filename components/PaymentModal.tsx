/**
 * PaymentModal — Flow paiement centralisé Nolink
 *
 * Deux cas d'usage :
 * 1) Première utilisation (pas de carte) : formulaire Stripe Elements (SetupIntent).
 *    Après confirmSetup → create-payment avec paymentMethodId → si 3DS on confirme puis poll status.
 *    Callback onSuccess(token) pour accès immédiat au SaaS.
 * 2) Confirmation 3DS uniquement : paymentIntentClientSecret fourni (paiement déjà initié avec carte enregistrée).
 *    confirmCardPayment puis poll /api/payment/status pour récupérer le token.
 * UI : résumé plan, montant, partenaire. Responsive, modal centré. PCI compliant via Stripe.
 */
import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  partnerId: string;
  planId: string;
  partnerName: string;
  planName: string;
  amount: number;
  returnUrl?: string;
  onSuccess: (token: string) => void;
  /** Si fourni, on affiche uniquement la confirmation 3DS (paiement déjà initié). */
  paymentIntentClientSecret?: string | null;
};

function PaymentForm({
  clientSecret,
  partnerId,
  planId,
  partnerName,
  planName,
  amount,
  onSuccess,
  onClose,
}: {
  clientSecret: string;
  partnerId: string;
  planId: string;
  partnerName: string;
  planName: string;
  amount: number;
  onSuccess: (token: string) => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: typeof window !== "undefined" ? window.location.href : "",
          payment_method_data: {},
        },
      });
      if (result.error) {
        setError(result.error.message ?? "Erreur d'enregistrement");
        setLoading(false);
        return;
      }
      const setupIntent = "setupIntent" in result ? result.setupIntent : null;
      const si = setupIntent as { payment_method?: string | { id?: string } | null } | null;
      const pmId =
        typeof si?.payment_method === "string"
          ? si.payment_method
          : si?.payment_method && typeof si.payment_method === "object"
            ? (si.payment_method as { id?: string }).id ?? null
            : null;
      if (!pmId) {
        setError("Mode de paiement introuvable");
        setLoading(false);
        return;
      }
      const createRes = await fetch("/api/payment/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, planId, paymentMethodId: pmId }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (createData.error) {
        setError(createData.error);
        setLoading(false);
        return;
      }
      if (createData.status === "succeeded") {
        const statusRes = await fetch(
          `/api/payment/status?payment_intent_id=${encodeURIComponent(createData.payment_intent_id)}`
        );
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.token) {
          onSuccess(statusData.token);
          onClose();
          return;
        }
      }
      if (createData.status === "requires_action" && createData.client_secret) {
        const { error: actionError } = await stripe.confirmCardPayment(
          createData.client_secret
        );
        if (actionError) {
          setError(actionError.message ?? "Erreur 3DS");
          setLoading(false);
          return;
        }
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const statusRes = await fetch(
            `/api/payment/status?payment_intent_id=${encodeURIComponent(createData.payment_intent_id)}`
          );
          const statusData = await statusRes.json().catch(() => ({}));
          if (statusData.token) {
            onSuccess(statusData.token);
            onClose();
            return;
          }
        }
      }
      setError("Paiement en cours. Vérifiez votre accès dans quelques secondes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Traitement…" : "Enregistrer et payer"}
      </button>
    </form>
  );
}

export default function PaymentModal({
  open,
  onClose,
  partnerId,
  planId,
  partnerName,
  planName,
  amount,
  onSuccess,
  paymentIntentClientSecret,
}: PaymentModalProps) {
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [threeDSLoading, setThreeDSLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (paymentIntentClientSecret) {
        setThreeDSLoading(true);
      const stripe = stripePromise;
      stripe?.then((s) => {
        if (!s) return;
        const paymentIntentId = paymentIntentClientSecret.split("_secret_")[0];
        s.confirmCardPayment(paymentIntentClientSecret).then(({ error }) => {
          setThreeDSLoading(false);
          if (error) return;
          const poll = async () => {
            const res = await fetch(
              `/api/payment/status?payment_intent_id=${encodeURIComponent(paymentIntentId)}`
            );
            const data = await res.json().catch(() => ({}));
            if (data.token) {
              onSuccess(data.token);
              onClose();
            }
          };
          poll();
          const id = setInterval(poll, 1500);
          setTimeout(() => clearInterval(id), 25000);
        });
      });
      return;
    }
    setSetupClientSecret(null);
    setLoading(true);
    fetch("/api/payment/setup-intent", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.client_secret) setSetupClientSecret(d.client_secret);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, partnerId, planId, paymentIntentClientSecret, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="payment-modal-title" className="text-lg font-semibold text-gray-900">
            Paiement — {partnerName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <p className="mb-2 text-sm text-gray-600">
          {planName} — €{(amount / 100).toFixed(2)}
        </p>
        {!paymentIntentClientSecret && setupClientSecret && (
          <p className="mb-3 text-xs text-gray-500">
            Enregistrez votre carte pour les prochains paiements en 1 clic.
          </p>
        )}

        {paymentIntentClientSecret ? (
          <p className="py-8 text-center text-gray-600">
            {threeDSLoading ? "Validation de votre carte en cours…" : "Redirection…"}
          </p>
        ) : loading ? (
          <p className="py-8 text-center text-gray-600">Chargement du formulaire…</p>
        ) : setupClientSecret ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: setupClientSecret,
              appearance: {
                theme: "stripe",
                variables: { borderRadius: "8px" },
              },
            }}
          >
            <PaymentForm
              clientSecret={setupClientSecret}
              partnerId={partnerId}
              planId={planId}
              partnerName={partnerName}
              planName={planName}
              amount={amount}
              onSuccess={onSuccess}
              onClose={onClose}
            />
          </Elements>
        ) : (
          <p className="py-4 text-sm text-red-600">
            Impossible de charger le formulaire de paiement.
          </p>
        )}
      </div>
    </div>
  );
}
