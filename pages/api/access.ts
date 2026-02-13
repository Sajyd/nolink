import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const SERVICES = [
  { id: "notion", url: "https://www.notion.so" },
  { id: "slack", url: "https://slack.com" },
  { id: "figma", url: "https://www.figma.com" },
];

const FREE_DAILY_LIMIT = 1;

async function isPro(userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: "active" },
  });
  return !!sub;
}

async function getTodayUsage(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const row = await prisma.usage.findUnique({
    where: { userId_date: { userId, date: new Date(today) } },
  });
  return row?.count ?? 0;
}

async function incrementUsage(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const date = new Date(today);
  await prisma.usage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ url?: string; error?: string }>
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Non connecté" });

  const { serviceId } = req.body ?? {};
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return res.status(400).json({ error: "Service inconnu" });

  const userId = session.user.id;
  const pro = await isPro(userId);
  if (!pro) {
    const used = await getTodayUsage(userId);
    if (used >= FREE_DAILY_LIMIT) {
      return res.status(402).json({
        error:
          "Limite freemium atteinte (1 test/jour). Passez Pro pour un accès illimité.",
      });
    }
  }

  await incrementUsage(userId);
  return res.status(200).json({ url: service.url });
}
