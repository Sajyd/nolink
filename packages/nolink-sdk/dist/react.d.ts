import * as React from 'react';
import { b as AccessButtonOptions, N as NolinkConfig } from './types-DnPw7amB.js';

/**
 * Composant React pour le bouton Accès immédiat Nolink
 */

interface AccessButtonProps extends AccessButtonOptions {
    serviceId: string;
}
/**
 * Bouton "Accès immédiat" pour React
 */
declare function NolinkAccessButton({ serviceId, ...options }: AccessButtonProps): React.ReactElement;
/**
 * Hook pour initialiser Nolink et gérer le retour avec token
 */
declare function useNolink(config: NolinkConfig | null): void;

export { NolinkAccessButton, useNolink };
