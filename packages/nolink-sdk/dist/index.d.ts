import { N as NolinkConfig, S as SubscriptionSuccessPayload, A as AccessErrorPayload, R as RecommendOptions, a as RecommendedService, b as AccessButtonOptions } from './types-DnPw7amB.js';

/**
 * Nolink.ai SDK — Intégration SaaS en 5 minutes
 * @packageDocumentation
 */

/**
 * Initialise le SDK avec la config partenaire.
 * @param config - Clé partenaire, branding, options
 * @throws Error si config invalide
 */
declare function init(config: NolinkConfig): void;
/**
 * Affiche un bouton "Accès immédiat" injecté dans la page.
 * Gère le flow : redirection vers login Nolink → paiement Stripe Connect → retour avec token.
 * @param serviceId - Slug ou ID du service (ex: "notion")
 * @param options - Texte, plan, couleur, cible d'injection
 * @returns L'élément bouton créé
 */
declare function showAccessButton(serviceId: string, options?: AccessButtonOptions): HTMLButtonElement;
/**
 * Enregistre un callback déclenché après conversion ou trial réussie.
 * @param callback - Reçoit userId, subscription_status, token
 */
declare function onSubscriptionSuccess(callback: (payload: SubscriptionSuccessPayload) => void): void;
/**
 * Enregistre un callback en cas d'erreur login/paiement.
 * @param callback - Reçoit code et message d'erreur
 */
declare function onAccessError(callback: (payload: AccessErrorPayload) => void): void;
/**
 * Traite le token dans l'URL au chargement (à appeler au init de la page).
 * Si nolink_token est présent, déclenche onSubscriptionSuccess et nettoie l'URL.
 */
declare function handleReturnToken(): SubscriptionSuccessPayload | null;
/**
 * Recommande des SaaS complémentaires pour post-checkout (upsell).
 * @param userId - ID utilisateur Nolink (optionnel si token fourni)
 * @param options - token JWT, limite
 * @returns Liste de services recommandés
 */
declare function recommendNextServices(slug: string, options?: RecommendOptions): Promise<RecommendedService[]>;
/**
 * Vérifie un token d'accès auprès de l'API Nolink.
 * @param token - JWT reçu après redirect
 * @returns user_id, partner_id, subscription_status
 */
declare function verifyToken(token: string): Promise<{
    user_id: string;
    partner_id: string;
    subscription_status: "active" | "freemium";
} | null>;
/**
 * Crée une URL d'iframe embed pour intégration alternative.
 * @param serviceId - Slug du service
 * @param options - Hauteur, largeur
 */
declare function getEmbedUrl(serviceId: string, options?: {
    height?: string;
    width?: string;
}): string;
/**
 * Retourne la config actuelle (pour debug).
 */
declare function getConfig(): NolinkConfig | null;

export { AccessButtonOptions, AccessErrorPayload, NolinkConfig, RecommendOptions, RecommendedService, SubscriptionSuccessPayload, getConfig, getEmbedUrl, handleReturnToken, init, onAccessError, onSubscriptionSuccess, recommendNextServices, showAccessButton, verifyToken };
