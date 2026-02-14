/**
 * Nolink.ai SDK — Intégration SaaS en 5 minutes
 * @packageDocumentation
 */

import type {
  NolinkConfig,
  AccessButtonOptions,
  RecommendOptions,
  RecommendedService,
  SubscriptionSuccessPayload,
  AccessErrorPayload,
} from "./types";

export type {
  NolinkConfig,
  AccessButtonOptions,
  RecommendOptions,
  RecommendedService,
  SubscriptionSuccessPayload,
  AccessErrorPayload,
} from "./types";

const DEFAULT_BASE = "https://nolink.ai";
const TOKEN_PARAM = "nolink_token";

/** État global du SDK */
let _config: NolinkConfig | null = null;
let _onSuccess: ((p: SubscriptionSuccessPayload) => void) | null = null;
let _onError: ((p: AccessErrorPayload) => void) | null = null;

/**
 * Initialise le SDK avec la config partenaire.
 * @param config - Clé partenaire, branding, options
 * @throws Error si config invalide
 */
export function init(config: NolinkConfig): void {
  if (!config?.partnerKey?.trim()) {
    throw new Error("nolink-sdk: partnerKey est requis");
  }
  const base = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  if (!base.startsWith("https://") && !base.startsWith("http://localhost")) {
    throw new Error("nolink-sdk: baseUrl doit être en HTTPS (ou localhost en dev)");
  }
  _config = { ...config, baseUrl: base };
}

/**
 * Valide que le SDK est initialisé.
 */
function requireInit(): NolinkConfig {
  if (!_config) throw new Error("nolink-sdk: appelle init() avant d'utiliser le SDK");
  return _config;
}

/**
 * Affiche un bouton "Accès immédiat" injecté dans la page.
 * Gère le flow : redirection vers login Nolink → paiement Stripe Connect → retour avec token.
 * @param serviceId - Slug ou ID du service (ex: "notion")
 * @param options - Texte, plan, couleur, cible d'injection
 * @returns L'élément bouton créé
 */
export function showAccessButton(
  serviceId: string,
  options: AccessButtonOptions = {}
): HTMLButtonElement {
  const cfg = requireInit();
  const slug = serviceId.trim();
  if (!slug) throw new Error("nolink-sdk: serviceId requis");

  const text = options.buttonText ?? "Accès immédiat";
  const color = options.color ?? cfg.primaryColor ?? "#6366f1";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = text;
  btn.style.cssText = `
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    background-color: ${color};
    color: white;
    border: none;
    cursor: pointer;
  `;
  btn.setAttribute("data-nolink-button", slug);

  btn.addEventListener("click", () => {
    const returnUrl = window.location.href;
    const params = new URLSearchParams();
    params.set("embed", "1");
    params.set("return_url", returnUrl);
    if (options.planId) params.set("plan", options.planId);
    const url = `${cfg.baseUrl}/s/${encodeURIComponent(slug)}?${params.toString()}`;
    window.location.href = url;
  });

  const target = options.mountTarget;
  if (target) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (el) el.appendChild(btn);
  }

  return btn;
}

/**
 * Enregistre un callback déclenché après conversion ou trial réussie.
 * @param callback - Reçoit userId, subscription_status, token
 */
export function onSubscriptionSuccess(callback: (payload: SubscriptionSuccessPayload) => void): void {
  _onSuccess = callback;
}

/**
 * Enregistre un callback en cas d'erreur login/paiement.
 * @param callback - Reçoit code et message d'erreur
 */
export function onAccessError(callback: (payload: AccessErrorPayload) => void): void {
  _onError = callback;
}

/**
 * Traite le token dans l'URL au chargement (à appeler au init de la page).
 * Si nolink_token est présent, déclenche onSubscriptionSuccess et nettoie l'URL.
 */
export function handleReturnToken(): SubscriptionSuccessPayload | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get(TOKEN_PARAM);
  if (!token) return null;

  try {
    const payload = parseJwtPayload(token);
    const status = payload.subscription_status as "active" | "freemium" | undefined;
    const result: SubscriptionSuccessPayload = {
      userId: payload.userId ?? "",
      subscriptionStatus: status === "freemium" ? "freemium" : "active",
      token,
    };
    _onSuccess?.(result);
    const url = new URL(window.location.href);
    url.searchParams.delete(TOKEN_PARAM);
    window.history.replaceState({}, "", url.toString());
    return result;
  } catch {
    _onError?.({ code: "INVALID_TOKEN", message: "Token invalide ou expiré" });
    return null;
  }
}

/** Parse le payload JWT (sans vérifier la signature côté client — la vérification se fait côté API) */
function parseJwtPayload(token: string): Record<string, string> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(b64);
  return JSON.parse(json) as Record<string, string>;
}

/**
 * Recommande des SaaS complémentaires pour post-checkout (upsell).
 * @param userId - ID utilisateur Nolink (optionnel si token fourni)
 * @param options - token JWT, limite
 * @returns Liste de services recommandés
 */
export async function recommendNextServices(
  slug: string,
  options: RecommendOptions = {}
): Promise<RecommendedService[]> {
  const cfg = requireInit();
  const base = cfg.baseUrl!.replace(/\/$/, "");

  const params = new URLSearchParams();
  params.set("slug", slug);
  if (options.token) params.set("token", options.token);
  if (options.limit) params.set("limit", String(options.limit));

  const url = `${base}/api/ai/recommend?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    _onError?.({ code: "RECOMMEND_FAILED", message: err.error ?? "Erreur recommandations" });
    return [];
  }

  return res.json();
}

/**
 * Vérifie un token d'accès auprès de l'API Nolink.
 * @param token - JWT reçu après redirect
 * @returns user_id, partner_id, subscription_status
 */
export async function verifyToken(token: string): Promise<{
  user_id: string;
  partner_id: string;
  subscription_status: "active" | "freemium";
} | null> {
  const cfg = requireInit();
  const base = cfg.baseUrl!.replace(/\/$/, "");
  const url = `${base}/api/access/verify?token=${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;
  return res.json();
}

/**
 * Crée une URL d'iframe embed pour intégration alternative.
 * @param serviceId - Slug du service
 * @param options - Hauteur, largeur
 */
export function getEmbedUrl(
  serviceId: string,
  options?: { height?: string; width?: string }
): string {
  const cfg = requireInit();
  const returnUrl = typeof window !== "undefined" ? window.location.href : "";
  const params = new URLSearchParams();
  params.set("embed", "1");
  if (returnUrl) params.set("return_url", returnUrl);
  return `${cfg.baseUrl}/s/${encodeURIComponent(serviceId)}?${params.toString()}`;
}

/**
 * Retourne la config actuelle (pour debug).
 */
export function getConfig(): NolinkConfig | null {
  return _config ? { ..._config } : null;
}
