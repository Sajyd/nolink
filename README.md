# nolink.ai — MVP

**Un seul compte. Accès immédiat à tous vos SaaS.**

Plateforme centralisant les abonnements SaaS : login unique, paiement centralisé Stripe, accès immédiat aux services. Deux espaces : **utilisateur** (client final) et **partenaire** (développeur SaaS).

## Setup (shippable en 24h)

```bash
cp .env.local.example .env.local
# Renseigner : NEXTAUTH_*, GOOGLE_*, DATABASE_URL, STRIPE_*, optionnel OPENAI_API_KEY
npm install
npx prisma generate
npx prisma db push
npx prisma db seed   # optionnel : partenaires Notion, Slack, Figma
npm run dev
```

## Structure des pages

| Page | Description |
|------|-------------|
| `/` | Landing SaaS — « Connectez votre SaaS et débloquez l'accès premium instantané » |
| `/login`, `/signup` | Redirections vers `/auth/signin`, `/auth/register` |
| `/dashboard` | Dashboard utilisateur (abonnements, services) |
| `/partner` | Dashboard SaaS (Accueil, Mes services, Intégration, Analytics) |
| `/partner/new` | Création d'un service SaaS |
| `/partner/[id]` | Détail service : Stripe Connect, plans, intégration |
| `/services/[id]` | Redirection vers `/partner/[id]` |
| `/plans/[id]` | Édition d'un plan |
| `/s/[slug]` | Page abonnement publique (plans, CTA) |

## Architecture

### 1) Espace utilisateur (client final)

- **Landing** : tagline, 3 étapes (créer compte → choisir SaaS → accès immédiat), CTA.
- **Auth** : NextAuth — email/mot de passe + Google OAuth, session JWT.
- **Dashboard** : liste des SaaS (logo, description, prix), bouton « Accès immédiat » ; abonnements actifs ; factures / moyen de paiement via Stripe Customer Portal.
- **Flow accès** : clic → vérif abonnement → si pas abonné → page abonnement `/s/[slug]` → paiement Stripe → activation → JWT → redirection vers le SaaS avec `?nolink_token=...`. Optionnel : POST callback vers l’endpoint du partenaire (`user_id`, `subscription_status`, `token`).

### 2) Espace partenaire (SaaS)

- **Dashboard SaaS** (`/partner`) : onglets Accueil (stats), Mes services, Intégration (snippet JS/iframe), Analytics (abonnements, revenus, AI recommendations).
- **Création SaaS** : nom, slug, logo, URL service, endpoint callback, description, couleurs, ctaLabel (ex. « Accès immédiat »), tags.
- **Stripe Connect** : onboarding Express pour recevoir les paiements.
- **Plans** : création de plans (nom, prix mensuel/annuel, features en bullet points, badge « Meilleur choix »). Stripe Connect : Product + Price créés automatiquement sur le compte partenaire.
- **Intégration** :
  - **Widget** : `<script src="https://nolink.ai/widget.js" data-slug="mon-saas"></script>`
  - **iframe** : `<iframe src="https://nolink.ai/s/mon-saas?embed=1" sandbox="..."></iframe>`
- **Callback** : après paiement/login, POST vers l’URL configurée avec `user_id`, `subscription_status`, `token` (JWT). Vérification du token : `GET /api/access/verify?token=xxx`.

### 3) AI (optionnel, avec `OPENAI_API_KEY`)

- **Génération** : description + tags depuis l’URL du site (formulaire partenaire).
- **Recommandations** : SaaS similaires sur le dashboard utilisateur.
- **Friction** : analyse conversion / abandon checkout et suggestions pour le partenaire.

## API principales

| Route | Description |
|-------|-------------|
| `GET /api/services` | Liste des SaaS (public) |
| `POST /api/access` | Accès SaaS → JWT + url de redirection (user) |
| `GET /api/access/verify` | Vérification JWT (côté SaaS) |
| `POST /api/create-subscription` | Création abonnement (partnerId, planId) |
| `POST /api/stripe-webhook` | Webhook Stripe (checkout, subscription) |
| `GET /api/partner/analytics` | Stats dashboard (services, abonnements, revenus) |
| `GET/POST/PATCH /api/partner/*` | CRUD partenaire (services, plans, Connect, update-plan) |
| `POST /api/ai/generate-service` | Génération description/tags depuis URL |
| `GET /api/ai/recommend?slug=` | Recommandations SaaS |
| `GET /api/ai/friction?partnerId=` | Analyse friction partenaire |

## Base de données (PostgreSQL / Neon)

- **Modèles** : User, Account, Session, Partner, Plan, Subscription, Transaction, Usage, AccessToken.
- **Partner** : `callbackUrl`, `userId` (owner), `tags` pour le dashboard partenaire et l’AI.
- Après changement de schéma : `npx prisma generate` puis `npx prisma db push`.

## Stripe

- **Checkout** : un prix Stripe par plan payant (`stripePriceId` sur Plan). Metadata : `user_id`, `partner_id`, `plan_id` pour le webhook.
- **Connect** : onboarding Express pour les partenaires (dashboard partenaire).
- **Webhook** : `https://votredomaine.com/api/stripe-webhook` — `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

## Sécurité

- JWT signés (NEXTAUTH_SECRET / jose) pour les tokens d’accès.
- Rate limiting (API) en mémoire.
- HTTPS only en production.
- CSP `frame-ancestors` : `*` pour `/s/*?embed=1`, `'self'` sinon.
- iframe `sandbox` sur le widget.
- Headers : `X-Content-Type-Options: nosniff`, `Referrer-Policy`.

## Déploiement (Vercel)

Connecter le repo, ajouter les variables d’env (NEXTAUTH_URL en prod, Stripe, DB, optionnel OPENAI), déployer. Configurer le webhook Stripe sur l’URL de production.
