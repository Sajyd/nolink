import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const SEED_SLUGS = [
  "blog-to-social-media",
  "ai-image-generator",
  "audio-transcribe-summarize",
  "product-marketing-kit",
  "code-review-pipeline",
  "document-analysis-report",
  "video-promo-from-text",
  "text-to-narration",
  "brand-logo-tagline",
  "quiz-generator",
];

async function main() {
  console.log("Seeding database...\n");

  const hashedPassword = await hash("demo123456", 12);

  const creator = await prisma.user.upsert({
    where: { email: "creator@nolink.ai" },
    update: {},
    create: {
      name: "AI Workflows",
      email: "creator@nolink.ai",
      hashedPassword,
      purchasedBalance: 2000,
      earnedBalance: 3000,
      subscription: "PRO",
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@nolink.ai" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@nolink.ai",
      hashedPassword,
      purchasedBalance: 500,
      earnedBalance: 0,
      subscription: "STARTER",
    },
  });

  console.log("Users ready:", creator.email, demoUser.email);

  // Delete existing seeded workflows so re-runs always refresh
  const existing = await prisma.workflow.findMany({
    where: { slug: { in: SEED_SLUGS } },
    select: { id: true },
  });
  const existingIds = existing.map((w) => w.id);

  if (existingIds.length > 0) {
    await prisma.execution.deleteMany({ where: { workflowId: { in: existingIds } } });
    await prisma.workflowAnalytics.deleteMany({ where: { workflowId: { in: existingIds } } });
    await prisma.workflow.deleteMany({ where: { id: { in: existingIds } } });
    console.log(`Cleaned up ${existingIds.length} existing seed workflows`);
  }

  // ─── 1. Blog → Social Media Pipeline ─────────────────────────

  const wf1 = await prisma.workflow.create({
    data: {
      name: "Blog → Social Media Pipeline",
      description:
        "Transform a blog topic into a full blog post, then generate social media captions for Twitter, LinkedIn, and Instagram.",
      category: "CONTENT",
      priceInNolinks: 10,
      isPublic: true,
      slug: "blog-to-social-media",
      tags: ["blog", "social media", "content", "marketing"],
      creatorId: creator.id,
      totalUses: 142,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Write Blog Post",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Write a well-structured, engaging blog post (800-1200 words) on the following topic. Include an attention-grabbing intro, clear subheadings, practical examples, and a strong conclusion with a call to action.\n\nTopic: {{input}}",
            params: { max_tokens: 4096, temperature: 0.8 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate Social Captions",
            stepType: "BASIC",
            aiModel: "gpt-4o-mini",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Based on this blog post, create 3 social media captions:\n\n1. **Twitter/X** (280 chars max, punchy, 2-3 hashtags)\n2. **LinkedIn** (professional tone, 2 short paragraphs, end with question)\n3. **Instagram** (conversational, include emoji, 5 relevant hashtags)\n\nBlog post:\n{{input}}",
            params: { max_tokens: 1024, temperature: 0.7 },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 2. AI Image Generator ───────────────────────────────────

  const wf2 = await prisma.workflow.create({
    data: {
      name: "AI Image Generator",
      description:
        "Generate stunning images from text prompts using FLUX.1 Pro. Describe what you want and get a high-quality AI-generated image.",
      category: "DESIGN",
      priceInNolinks: 5,
      isPublic: true,
      slug: "ai-image-generator",
      tags: ["image", "art", "design", "ai-art", "generation"],
      creatorId: creator.id,
      totalUses: 389,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Generate Image",
            stepType: "FAL_AI",
            aiModel: "fal-flux-pro",
            inputType: "TEXT",
            outputType: "IMAGE",
            prompt: "{{input}}",
            params: {
              prompt: "{{input}}",
              image_size: "landscape_4_3",
              num_inference_steps: 28,
              guidance_scale: 3.5,
            },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "IMAGE",
            outputType: "IMAGE",
            prompt: "",
            positionX: 600,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 3. Audio Transcription + Summary ─────────────────────────

  const wf3 = await prisma.workflow.create({
    data: {
      name: "Audio Transcription + Summary",
      description:
        "Upload audio from meetings, podcasts, or lectures. Whisper transcribes it, then GPT-4o extracts key points and action items.",
      category: "AUDIO_VIDEO",
      priceInNolinks: 8,
      isPublic: true,
      slug: "audio-transcribe-summarize",
      tags: ["audio", "transcription", "summary", "podcast", "meeting"],
      creatorId: creator.id,
      totalUses: 217,
      steps: {
        create: [
          {
            order: 1,
            name: "Upload Audio",
            stepType: "INPUT",
            inputType: "AUDIO",
            outputType: "AUDIO",
            prompt: "",
            acceptTypes: ["audio"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Transcribe Audio",
            stepType: "BASIC",
            aiModel: "whisper-1",
            inputType: "AUDIO",
            outputType: "TEXT",
            prompt: "",
            params: { language: "en" },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Summarize & Extract",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Analyze this transcription and produce:\n\n## Summary\nA concise 2-3 sentence overview.\n\n## Key Points\n- 5 bullet points of the most important information.\n\n## Action Items\n- List any tasks, decisions, or follow-ups mentioned.\n\n## Notable Quotes\n- Any particularly insightful or important statements.\n\nTranscription:\n{{input}}",
            params: { max_tokens: 2048, temperature: 0.5 },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 4. Product Marketing Kit ─────────────────────────────────

  const wf4 = await prisma.workflow.create({
    data: {
      name: "Product Marketing Kit",
      description:
        "Enter a product name and description to get a professional product image, marketing copy, and ad variants for multiple platforms.",
      category: "MARKETING",
      priceInNolinks: 15,
      isPublic: true,
      slug: "product-marketing-kit",
      tags: ["product", "marketing", "e-commerce", "copywriting", "image"],
      creatorId: creator.id,
      totalUses: 93,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Generate Product Image",
            stepType: "BASIC",
            aiModel: "dall-e-3",
            inputType: "TEXT",
            outputType: "IMAGE",
            prompt:
              "Professional product photography on a clean white background, studio lighting, commercial quality, high resolution. Product: {{input}}",
            params: { size: "1024x1024", quality: "hd" },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Write Marketing Copy",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Create a complete marketing kit for this product:\n\n## Product Listing\n- Catchy headline\n- 3 key features with benefits\n- 150-word product description\n- SEO meta description (160 chars)\n\n## Ad Copy Variants\n1. **Facebook/Instagram Ad** — short, punchy, with CTA\n2. **Google Search Ad** — headline + 2 description lines\n3. **Email Subject Line** + preview text\n\nProduct: {{input}}",
            params: { max_tokens: 2048, temperature: 0.7 },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 5. Code Review & Documentation ───────────────────────────

  const wf5 = await prisma.workflow.create({
    data: {
      name: "Code Review & Documentation",
      description:
        "Paste your code to get a thorough review for bugs, security issues, and performance, then auto-generate documentation and improvement suggestions.",
      category: "DEVELOPMENT",
      priceInNolinks: 8,
      isPublic: true,
      slug: "code-review-pipeline",
      tags: ["code", "review", "development", "security", "documentation"],
      creatorId: creator.id,
      totalUses: 178,
      steps: {
        create: [
          {
            order: 1,
            name: "Paste Code",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Code Review",
            stepType: "BASIC",
            aiModel: "claude-4-sonnet",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Perform a thorough code review. Evaluate on a 1-10 scale for each category:\n\n1. **Correctness** — bugs, logic errors, edge cases\n2. **Security** — vulnerabilities, injection risks, auth issues\n3. **Performance** — bottlenecks, memory leaks, complexity\n4. **Readability** — naming, structure, patterns\n\nFor each issue found, show the problematic code and a suggested fix.\n\nCode:\n```\n{{input}}\n```",
            params: { max_tokens: 4096, temperature: 0.3 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate Docs",
            stepType: "BASIC",
            aiModel: "gpt-4o-mini",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Based on this code review, generate:\n\n1. **Function Documentation** — JSDoc/docstring for every function\n2. **README Section** — purpose, usage examples, and API reference\n3. **Improvement Roadmap** — prioritized list of suggested refactors with code snippets\n\nReview:\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.5 },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 6. Document Analysis Report ──────────────────────────────

  const wf6 = await prisma.workflow.create({
    data: {
      name: "Document Analysis Report",
      description:
        "Upload a document or paste its content to get structured insights, trend analysis, and a formatted executive report.",
      category: "DATA",
      priceInNolinks: 12,
      isPublic: true,
      slug: "document-analysis-report",
      tags: ["document", "analysis", "report", "research", "executive"],
      creatorId: creator.id,
      totalUses: 64,
      steps: {
        create: [
          {
            order: 1,
            name: "Upload Document",
            stepType: "INPUT",
            inputType: "DOCUMENT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["document", "text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Extract & Parse",
            stepType: "BASIC",
            aiModel: "gpt-5.2-doc",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Extract and organize the key information from this document:\n\n1. **Main Topics** — identify all major themes\n2. **Data Points** — numbers, statistics, metrics\n3. **Key Quotes** — important statements verbatim\n4. **Entities** — people, organizations, dates mentioned\n\nStructure the output clearly with headers.\n\nDocument:\n{{input}}",
            params: { max_tokens: 4096 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate Executive Report",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Create a professional executive report in Markdown:\n\n## Executive Summary\nOne paragraph overview.\n\n## Key Findings\nBulleted list of 5-7 findings.\n\n## Analysis & Insights\nTrends, patterns, and implications.\n\n## Risks & Concerns\nPotential issues identified.\n\n## Recommendations\nActionable next steps with priority levels.\n\nExtracted content:\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.5 },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 7. Video Promo from Text ─────────────────────────────────

  const wf7 = await prisma.workflow.create({
    data: {
      name: "Video Promo from Text",
      description:
        "Describe your concept and get a key frame generated with FLUX, then animated into a short promo video with Kling 1.6.",
      category: "AUDIO_VIDEO",
      priceInNolinks: 25,
      isPublic: true,
      slug: "video-promo-from-text",
      tags: ["video", "promo", "animation", "creative", "marketing"],
      creatorId: creator.id,
      totalUses: 41,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Generate Key Frame",
            stepType: "FAL_AI",
            aiModel: "fal-flux-pro",
            inputType: "TEXT",
            outputType: "IMAGE",
            prompt: "{{input}}",
            params: {
              prompt: "cinematic still frame, professional lighting, vibrant colors, photorealistic, 4K quality — {{input}}",
              image_size: "landscape_16_9",
              num_inference_steps: 28,
              guidance_scale: 3.5,
            },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Animate to Video",
            stepType: "FAL_AI",
            aiModel: "fal-kling-1.6",
            inputType: "IMAGE",
            outputType: "VIDEO",
            prompt: "{{input}}",
            params: {
              prompt: "smooth cinematic motion, professional commercial, gentle camera movement — {{input}}",
              duration: "5",
              aspect_ratio: "16:9",
            },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "VIDEO",
            outputType: "VIDEO",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 8. Text to Narration ─────────────────────────────────────

  const wf8 = await prisma.workflow.create({
    data: {
      name: "Text to Narration",
      description:
        "Paste any text and get a polished, narration-ready script turned into high-quality spoken audio. Perfect for voiceovers and audiobooks.",
      category: "AUDIO_VIDEO",
      priceInNolinks: 6,
      isPublic: true,
      slug: "text-to-narration",
      tags: ["audio", "tts", "narration", "voiceover", "speech"],
      creatorId: creator.id,
      totalUses: 126,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Polish Script",
            stepType: "BASIC",
            aiModel: "gpt-4o-mini",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Rewrite this text as a clear, natural-sounding narration script. Remove any formatting, links, or visual references. Add natural pauses with commas and periods. Keep the meaning intact but optimize for spoken delivery. Output only the final script, no commentary.\n\nText:\n{{input}}",
            params: { max_tokens: 2048, temperature: 0.5 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate Speech",
            stepType: "BASIC",
            aiModel: "openai-tts-1-hd",
            inputType: "TEXT",
            outputType: "AUDIO",
            prompt: "{{input}}",
            params: { voice: "nova", speed: 1.0 },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "AUDIO",
            outputType: "AUDIO",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 9. Brand Logo & Tagline ──────────────────────────────────

  const wf9 = await prisma.workflow.create({
    data: {
      name: "Brand Logo & Tagline",
      description:
        "Describe your brand or business and get a creative tagline, brand concept, and a logo generated with Nano Banana Pro.",
      category: "DESIGN",
      priceInNolinks: 10,
      isPublic: true,
      slug: "brand-logo-tagline",
      tags: ["brand", "logo", "design", "tagline", "identity"],
      creatorId: creator.id,
      totalUses: 75,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Brand Concept",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Create a brand identity concept:\n\n1. **Tagline** — a memorable, short tagline (under 8 words)\n2. **Brand Voice** — 3 adjectives that define the tone\n3. **Color Palette** — 3 hex colors with names\n4. **Logo Description** — detailed description for image generation: style, shapes, typography, mood. Be very specific.\n\nBusiness description:\n{{input}}",
            params: { max_tokens: 1024, temperature: 0.8 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate Logo",
            stepType: "FAL_AI",
            aiModel: "fal-nano-banana-pro",
            inputType: "TEXT",
            outputType: "IMAGE",
            prompt: "{{input}}",
            params: {
              prompt: "minimalist professional logo design, clean vector style, white background, centered composition — {{input}}",
              image_size: "square_hd",
              num_inference_steps: 40,
              guidance_scale: 7.5,
              enable_safety_checker: true,
            },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "IMAGE",
            outputType: "IMAGE",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  // ─── 10. Quiz & Lesson Generator ──────────────────────────────

  const wf10 = await prisma.workflow.create({
    data: {
      name: "Quiz & Lesson Generator",
      description:
        "Enter any topic and get a structured lesson plan with explanations, followed by a quiz with answers. Built for educators and self-learners.",
      category: "EDUCATION",
      priceInNolinks: 8,
      isPublic: true,
      slug: "quiz-generator",
      tags: ["education", "quiz", "lesson", "learning", "teaching"],
      creatorId: creator.id,
      totalUses: 102,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Create Lesson",
            stepType: "BASIC",
            aiModel: "gemini-3",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Create a comprehensive lesson on this topic:\n\n## Learning Objectives\n3 clear objectives students will achieve.\n\n## Lesson Content\nExplain the topic in 4-5 sections with clear headings. Use analogies and real-world examples. Define key terms.\n\n## Key Takeaways\n5 bullet points summarizing the most important concepts.\n\nTopic: {{input}}",
            params: { max_tokens: 4096, temperature: 0.7 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate Quiz",
            stepType: "BASIC",
            aiModel: "gpt-4o-mini",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Based on this lesson, create a quiz:\n\n## Quiz (10 questions)\n1-5: Multiple choice (A/B/C/D)\n6-8: True or False\n9-10: Short answer\n\n## Answer Key\nList all correct answers with brief explanations for why each answer is correct.\n\nLesson content:\n{{input}}",
            params: { max_tokens: 2048, temperature: 0.5 },
            positionX: 600,
            positionY: 100,
          },
          {
            order: 4,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            positionX: 900,
            positionY: 100,
          },
        ],
      },
    },
  });

  const workflows = [wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8, wf9, wf10];

  console.log(`\nSeeded ${workflows.length} workflows:`);
  workflows.forEach((wf, i) => console.log(`  ${i + 1}. ${wf.name} (${wf.slug})`));
  console.log("\nDemo accounts:");
  console.log("  Creator: creator@nolink.ai / demo123456");
  console.log("  User:    demo@nolink.ai / demo123456");
  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
