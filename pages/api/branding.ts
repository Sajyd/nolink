import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import prisma from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (session.user.subscription !== "ENTERPRISE") {
    return res.status(403).json({ error: "Custom branding is available on the Enterprise plan" });
  }

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { brandName: true, brandLogoUrl: true },
    });
    return res.json(user);
  }

  if (req.method === "PUT") {
    const { brandName, brandLogoUrl } = req.body;

    if (brandName !== undefined && typeof brandName !== "string") {
      return res.status(400).json({ error: "brandName must be a string" });
    }
    if (brandName && brandName.length > 50) {
      return res.status(400).json({ error: "brandName must be 50 characters or less" });
    }
    if (brandLogoUrl !== undefined && brandLogoUrl !== null && typeof brandLogoUrl !== "string") {
      return res.status(400).json({ error: "brandLogoUrl must be a string or null" });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(brandName !== undefined && { brandName: brandName || null }),
        ...(brandLogoUrl !== undefined && { brandLogoUrl: brandLogoUrl || null }),
      },
      select: { brandName: true, brandLogoUrl: true },
    });

    return res.json({ success: true, ...updated });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
