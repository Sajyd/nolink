/**
 * Appels LLM simples (OpenAI) pour génération description, tags, recommandations, analyse friction.
 * Si OPENAI_API_KEY absent, retourne des valeurs par défaut (MVP).
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function chat(system: string, user: string): Promise<string> {
  if (!OPENAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 300,
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text ?? "";
  } catch (e) {
    console.error("AI error:", e);
    return "";
  }
}

/** Génère description courte + tags à partir d'une URL de site. */
export async function generateDescriptionAndTags(url: string): Promise<{
  description: string;
  tags: string;
}> {
  const text = await chat(
    "Tu es un assistant. Réponds uniquement en JSON avec les clés: description (courte, 1 phrase), tags (séparés par des virgules, catégories type productivité, collaboration, etc.).",
    `À partir de cette URL de site web, génère une description courte et des tags catégories. URL: ${url}`
  );
  try {
    const parsed = JSON.parse(text) as { description?: string; tags?: string };
    return {
      description: parsed.description ?? "",
      tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]).join(", ") : (parsed.tags ?? ""),
    };
  } catch {
    return { description: "", tags: "" };
  }
}

/** Recommande des slugs de SaaS similaires (par tags/description). */
export async function recommendSimilar(
  currentSlug: string,
  services: { id: string; name: string; slug: string; description?: string | null; tags?: string | null }[]
): Promise<string[]> {
  const others = services.filter((s) => s.slug !== currentSlug);
  if (others.length === 0) return [];
  const list = others.map((s) => `${s.slug}: ${s.description || ""} ${s.tags || ""}`).join("\n");
  const text = await chat(
    "Tu es un assistant. Réponds uniquement par une liste de slugs séparés par des virgules, sans explication.",
    `Parmi ces SaaS, lesquels sont les plus similaires ou complémentaires à "${currentSlug}" ? Donne 2 à 4 slugs.\n\n${list}`
  );
  const slugs = text.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return slugs.slice(0, 4);
}

/** Analyse friction : taux conversion, abandon checkout → suggestions. */
export async function analyzeFriction(stats: {
  views: number;
  checkoutsStarted: number;
  checkoutsCompleted: number;
  serviceName: string;
}): Promise<string> {
  const rate = stats.views ? (stats.checkoutsCompleted / stats.views) * 100 : 0;
  const abandon = stats.checkoutsStarted
    ? (1 - stats.checkoutsCompleted / stats.checkoutsStarted) * 100
    : 0;
  const text = await chat(
    "Tu es un expert conversion SaaS. Donne 2-3 suggestions courtes et actionnables pour améliorer le taux de conversion et réduire l'abandon au checkout. Réponds en 2-3 phrases.",
    `Service: ${stats.serviceName}. Vues: ${stats.views}, Checkouts commencés: ${stats.checkoutsStarted}, Checkouts complétés: ${stats.checkoutsCompleted}. Taux conversion: ${rate.toFixed(1)}%, Abandon: ${abandon.toFixed(1)}%.`
  );
  return text || "Pas assez de données pour l'instant.";
}
