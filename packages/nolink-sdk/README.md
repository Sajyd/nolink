# nolink-sdk

SDK officiel pour intégrer **Nolink.ai** à votre SaaS en 5 minutes. Bouton "Accès immédiat", flow login/paiement Stripe Connect, JWT sécurisé, recommandations IA post-checkout.

## Installation

```bash
npm install nolink-sdk
```

## Intégration rapide (vanilla JS)

```html
<script type="module">
  import { init, showAccessButton, onSubscriptionSuccess, onAccessError, handleReturnToken } from 'nolink-sdk';

  init({
    partnerKey: 'votre-slug',
    baseUrl: 'https://nolink.ai',
    primaryColor: '#6366f1'
  });

  onSubscriptionSuccess(({ userId, token, subscriptionStatus }) => {
    console.log('Accès accordé:', userId);
    // Stocker le token, rediriger, etc.
  });

  onAccessError(({ code, message }) => {
    console.error('Erreur:', code, message);
  });

  handleReturnToken();

  const btn = showAccessButton('notion', {
    buttonText: 'Accès immédiat',
    color: '#6366f1',
    mountTarget: '#nolink-container'
  });
</script>
<div id="nolink-container"></div>
```

## React

```tsx
import { init, handleReturnToken, onSubscriptionSuccess, NolinkAccessButton, useNolink } from 'nolink-sdk/react';

function App() {
  useNolink({
    partnerKey: 'notion',
    baseUrl: 'https://nolink.ai',
    primaryColor: '#6366f1'
  });

  return (
    <div>
      <NolinkAccessButton
        serviceId="notion"
        buttonText="Accès immédiat"
        color="#6366f1"
      />
    </div>
  );
}
```

## Vue 3

```vue
<template>
  <NolinkAccessButton
    serviceId="notion"
    buttonText="Accès immédiat"
    color="#6366f1"
  />
</template>

<script setup>
import { init, handleReturnToken } from 'nolink-sdk';
import { NolinkAccessButton } from 'nolink-sdk/vue';

init({ partnerKey: 'notion', baseUrl: 'https://nolink.ai' });
handleReturnToken();
</script>
```

## API

### `init(config)`

Initialise le SDK. **Obligatoire** avant toute autre fonction.

| Option      | Type   | Description                    |
|-------------|--------|--------------------------------|
| partnerKey  | string | Slug ou ID du service (requis) |
| baseUrl     | string | URL Nolink (défaut: https://nolink.ai) |
| primaryColor| string | Couleur branding (hex)         |

### `showAccessButton(serviceId, options?)`

Injecte un bouton "Accès immédiat". Au clic : redirection vers login Nolink → paiement Stripe Connect → retour avec token.

| Option     | Type           | Description                |
|------------|----------------|----------------------------|
| buttonText | string         | Texte du bouton            |
| planId     | string         | ID du plan ciblé           |
| color      | string         | Couleur (hex)              |
| mountTarget| string \| HTMLElement | Sélecteur ou élément DOM |

### `onSubscriptionSuccess(callback)`

Callback après conversion ou trial réussie. Reçoit `{ userId, subscriptionStatus, token }`.

### `onAccessError(callback)`

Callback en cas d'erreur login/paiement. Reçoit `{ code, message }`.

### `handleReturnToken()`

À appeler au chargement de la page. Détecte `?nolink_token=xxx` dans l’URL, déclenche `onSubscriptionSuccess` et nettoie l’URL.

### `recommendNextServices(slug, options?)`

Recommande des SaaS complémentaires (upsell post-checkout).

```js
const services = await recommendNextServices('notion', {
  token: nolinkToken,
  limit: 4
});
```

### `verifyToken(token)`

Vérifie un JWT auprès de l’API Nolink. Retourne `{ user_id, partner_id, subscription_status }`.

### `getEmbedUrl(serviceId)`

Génère l’URL d’un embed iframe en alternative au bouton.

## Sécurité

- JWT signés (HS256)
- HTTPS obligatoire en production
- Compatible PCI via Stripe Connect (aucune donnée carte côté SDK)
- Protection XSS (texte échappé via `textContent`)

## CDN (vanilla, sans build)

```html
<script src="https://unpkg.com/nolink-sdk/dist/index.global.js"></script>
<script>
  Nolink.init({ partnerKey: 'notion', baseUrl: 'https://nolink.ai' });
  Nolink.onSubscriptionSuccess(function(p) { console.log('Succès', p); });
  Nolink.onAccessError(function(p) { console.error('Erreur', p); });
  Nolink.handleReturnToken();
  Nolink.showAccessButton('notion', { mountTarget: '#btn' });
</script>
<div id="btn"></div>
```

## Licence

MIT
