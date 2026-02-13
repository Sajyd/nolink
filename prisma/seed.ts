/**
 * Seed nolink.ai : crée 2–3 partenaires SaaS (Notion, Slack, Figma) avec plans Freemium et Pro.
 * Stripe Price IDs et Connect account IDs à définir en env ou à créer dans le Dashboard Stripe.
 * Exécution : npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const partners = [
    {
      name: "Notion",
      slug: "notion",
      logoUrl: "/partners/notion.svg",
      primaryColor: "#000000",
      description: "Espace de travail tout-en-un : docs, bases de données, wikis.",
      features: ["Docs illimités", "Bases de données", "Templates", "Collaboration"],
      url: "https://www.notion.so",
      stripeAccountId: process.env.STRIPE_CONNECT_ACCOUNT_NOTION || null,
    },
    {
      name: "Slack",
      slug: "slack",
      logoUrl: "/partners/slack.svg",
      primaryColor: "#4A154B",
      description: "Messagerie professionnelle et collaboration d'équipe.",
      features: ["Canaux", "Intégrations", "Recherche", "Partage de fichiers"],
      url: "https://slack.com",
      stripeAccountId: process.env.STRIPE_CONNECT_ACCOUNT_SLACK || null,
    },
    {
      name: "Figma",
      slug: "figma",
      logoUrl: "/partners/figma.svg",
      primaryColor: "#F24E1E",
      description: "Design collaboratif et prototypage d'interfaces.",
      features: ["Design en temps réel", "Prototypes", "Handoff", "Plugins"],
      url: "https://www.figma.com",
      stripeAccountId: process.env.STRIPE_CONNECT_ACCOUNT_FIGMA || null,
    },
  ];

  for (const p of partners) {
    const partner = await prisma.partner.upsert({
      where: { slug: p.slug },
      create: {
        name: p.name,
        slug: p.slug,
        logoUrl: p.logoUrl,
        primaryColor: p.primaryColor,
        description: p.description,
        features: p.features,
        url: p.url,
        stripeAccountId: p.stripeAccountId,
      },
      update: {
        description: p.description,
        features: p.features,
        url: p.url,
        primaryColor: p.primaryColor,
      },
    });

    // Plans Freemium (0€) et Pro (prix test : 19€/mois)
    const stripePriceIdPro = process.env[`STRIPE_PRICE_${p.slug.toUpperCase()}_PRO`] || null;
    const existingFreemium = await prisma.plan.findFirst({
      where: { partnerId: partner.id, name: "Freemium" },
    });
    if (!existingFreemium) {
      await prisma.plan.create({
        data: {
          partnerId: partner.id,
          name: "Freemium",
          amount: 0,
          interval: null,
          features: ["Accès limité", "1 test / jour"],
        },
      });
    }

    const existingPro = await prisma.plan.findFirst({
      where: { partnerId: partner.id, name: "Pro" },
    });
    if (!existingPro) {
      await prisma.plan.create({
        data: {
          partnerId: partner.id,
          name: "Pro",
          stripePriceId: stripePriceIdPro,
          amount: 1900, // 19€
          interval: "month",
          features: ["Accès illimité", "Support prioritaire", "Export"],
        },
      });
    }
  }

  console.log("Seed OK: partenaires et plans créés.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
