/**
 * Rate limiting simple en mémoire (par IP). Utilisé pour /api/access et /api/create-subscription.
 * En production, préférer Redis ou Vercel KV.
 */

const WINDOW_MS = 60 * 1000; // 1 min
const MAX_REQUESTS = 30;

const store = new Map<string, { count: number; resetAt: number }>();

function getClientId(req: { headers?: { [key: string]: string | string[] | undefined } }): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  const realIp = req.headers?.["x-real-ip"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (typeof realIp === "string") return realIp;
  return "unknown";
}

export function checkRateLimit(req: { headers?: { [key: string]: string | string[] | undefined } }): boolean {
  const key = getClientId(req);
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) return false;
  return true;
}
