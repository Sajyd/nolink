/**
 * Composant React pour le bouton Accès immédiat Nolink
 */

import * as React from "react";
import { showAccessButton, init, handleReturnToken } from "./index";
import type { AccessButtonOptions, NolinkConfig } from "./types";

interface AccessButtonProps extends AccessButtonOptions {
  serviceId: string;
}

/**
 * Bouton "Accès immédiat" pour React
 */
export function NolinkAccessButton({ serviceId, ...options }: AccessButtonProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const btn = showAccessButton(serviceId, { ...options, mountTarget: ref.current });
    return () => btn.remove();
  }, [serviceId, options.buttonText, options.planId, options.color]);

  return <div ref={ref} data-nolink-react />;
}

/**
 * Hook pour initialiser Nolink et gérer le retour avec token
 */
export function useNolink(config: NolinkConfig | null): void {
  React.useEffect(() => {
    if (!config) return;
    init(config);
  }, [config?.partnerKey, config?.baseUrl]);

  React.useEffect(() => {
    handleReturnToken();
  }, []);
}
