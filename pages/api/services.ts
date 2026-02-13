import type { NextApiRequest, NextApiResponse } from "next";

const SERVICES = [
  {
    id: "notion",
    slug: "notion",
    name: "Notion",
    description: "Espace de travail tout-en-un : docs, bases de données, wikis.",
    url: "https://www.notion.so",
  },
  {
    id: "slack",
    slug: "slack",
    name: "Slack",
    description: "Messagerie professionnelle et collaboration d'équipe.",
    url: "https://slack.com",
  },
  {
    id: "figma",
    slug: "figma",
    name: "Figma",
    description: "Design collaboratif et prototypage d'interfaces.",
    url: "https://www.figma.com",
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  return res.status(200).json(SERVICES);
}
