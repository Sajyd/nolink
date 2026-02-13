# nolink.ai — MVP

Un seul compte, accès instantané à tous vos SaaS. Login Google + paiement centralisé Stripe (Pro 19€/mois).

## Setup

```bash
cp .env.local.example .env.local
# Renseigner les variables (Google OAuth, Stripe, DATABASE_URL)
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Base de données (PostgreSQL / Neon)

Le schéma Prisma est dans `prisma/schema.prisma`. Modèles : `Usage` (freemium 1 test/jour), `Subscription` (Stripe Pro).

- Mettre l’URL Neon dans `.env` ou `.env.local` : `DATABASE_URL="postgresql://..."`
- Créer les tables : `npx prisma db push`
- (Optionnel) Après changement de schéma : `npx prisma generate` puis `npx prisma db push`

## Stripe

- Créer un produit « Pro » et un prix récurrent 19€/mois.
- Copier l’id du prix dans `STRIPE_PRICE_ID_PRO`.
- Webhook : `https://votredomaine.com/api/stripe-webhook` — événements `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

## Déploiement Vercel

Connecter le repo, ajouter les variables d’env, déployer.
