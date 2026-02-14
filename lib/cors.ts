/**
 * CORS headers pour les APIs appelées depuis le SDK partenaire (cross-origin).
 */
import type { NextApiResponse } from "next";

export function setCorsHeaders(res: NextApiResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
