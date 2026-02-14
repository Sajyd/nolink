/**
 * Types du SDK Nolink.ai
 */

/** Config d'initialisation */
export interface NolinkConfig {
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
export interface AccessButtonOptions {
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
export interface RecommendedService {
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
export interface RecommendOptions {
  /** JWT token (après login/paiement) */
  token?: string;
  /** Nombre max de recommandations */
  limit?: number;
}

/** Payload du callback onSubscriptionSuccess */
export interface SubscriptionSuccessPayload {
  userId: string;
  subscriptionStatus: "active" | "freemium";
  token: string;
}

/** Payload du callback onAccessError */
export interface AccessErrorPayload {
  code: string;
  message: string;
}
