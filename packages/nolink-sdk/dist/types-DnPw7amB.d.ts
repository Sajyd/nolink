/**
 * Types du SDK Nolink.ai
 */
/** Config d'initialisation */
interface NolinkConfig {
    /** Clé partenaire (slug ou serviceId) */
    partnerKey: string;
    /** URL de base Nolink (https://nolink.ai en prod) */
    baseUrl?: string;
    /** Couleur principale du branding */
    primaryColor?: string;
    /** Nom du partenaire pour affichage */
    partnerName?: string;
}
/** Options du bouton Accès immédiat */
interface AccessButtonOptions {
    /** Texte du bouton */
    buttonText?: string;
    /** ID du plan ciblé (optionnel) */
    planId?: string;
    /** Couleur du bouton (hex) */
    color?: string;
    /** Sélecteur ou élément DOM pour injecter le bouton */
    mountTarget?: string | HTMLElement;
}
/** Recommandation de service */
interface RecommendedService {
    id: string;
    name: string;
    slug: string;
    description: string;
    logoUrl: string | null;
    primaryColor: string | null;
    url?: string;
    plans: {
        id: string;
        name: string;
        amount: number;
        interval: string | null;
        features: string[];
    }[];
}
/** Options pour recommendNextServices */
interface RecommendOptions {
    /** JWT token (après login/paiement) */
    token?: string;
    /** Nombre max de recommandations */
    limit?: number;
}
/** Payload du callback onSubscriptionSuccess */
interface SubscriptionSuccessPayload {
    userId: string;
    subscriptionStatus: "active" | "freemium";
    token: string;
}
/** Payload du callback onAccessError */
interface AccessErrorPayload {
    code: string;
    message: string;
}

export type { AccessErrorPayload as A, NolinkConfig as N, RecommendOptions as R, SubscriptionSuccessPayload as S, RecommendedService as a, AccessButtonOptions as b };
