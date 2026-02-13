/**
 * Page vérification email : affiche succès ou erreur après clic sur le lien (token en query).
 * GET avec token appelle l’API pour marquer emailVerified ; pas d’envoi d’email dans le MVP.
 */

import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function VerifyEmail() {
  const router = useRouter();
  const token = router.query.token as string | undefined;
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!token || !router.isReady) return;
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.ok) setStatus("ok");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [token, router.isReady]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="mb-8 block text-xl font-semibold text-gray-900">
          nolink.ai
        </Link>
        {status === "loading" && <p className="text-gray-600">Vérification…</p>}
        {status === "ok" && (
          <p className="text-green-600">Email vérifié. Vous pouvez vous connecter.</p>
        )}
        {status === "error" && (
          <p className="text-red-600">Lien invalide ou expiré.</p>
        )}
        <Link href="/auth/signin" className="mt-6 inline-block font-medium text-gray-900 hover:underline">
          Se connecter
        </Link>
      </div>
    </div>
  );
}
