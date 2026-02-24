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
  "youtube-to-twitter-thread",
  "tiktok-hooks-generator",
  "cv-to-job-application",
  "cold-email-personalization",
  "pdf-to-actionable-checklist",
  "voice-note-to-meeting-minutes",
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
            aiModel: "fal-kling-1.6-t2v",
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

  // ─── 11. YouTube → Viral Twitter Thread ───────────────────────

  const wf11 = await prisma.workflow.create({
    data: {
      name: "YouTube → Viral Twitter Thread",
      description:
        "Paste any YouTube video URL or transcript and get a viral-ready Twitter/X thread with hooks, key insights, and engagement-optimized formatting.",
      category: "CONTENT",
      priceInNolinks: 8,
      isPublic: true,
      slug: "youtube-to-twitter-thread",
      tags: ["youtube", "twitter", "thread", "viral", "repurpose", "social media"],
      creatorId: creator.id,
      totalUses: 263,
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
            name: "Extract Key Insights",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "You are a content repurposing expert. Analyze this YouTube video transcript or description and extract:\n\n1. **Core thesis** — the single big idea in one sentence\n2. **5-8 key insights** — the most valuable, surprising, or actionable points\n3. **Quotable moments** — any punchy one-liners or hot takes\n4. **Target audience** — who would care about this content\n5. **Emotional hooks** — what makes this content shareable (curiosity, controversy, inspiration, practical value)\n\nBe specific and preserve the original voice/tone.\n\nInput:\n{{input}}",
            params: { max_tokens: 2048, temperature: 0.6 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Write Twitter Thread",
            stepType: "BASIC",
            aiModel: "claude-4-sonnet",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "You are a Twitter ghostwriter who has written threads with 10M+ impressions. Using these extracted insights, write a viral Twitter/X thread.\n\nRules:\n- Tweet 1 (hook): Must stop the scroll. Use a bold claim, surprising stat, or contrarian take. End with \"🧵👇\"\n- Tweets 2-9: One insight per tweet. Use short sentences. Add line breaks for readability. Mix formats: lists, one-liners, \"Here's the thing:\" reveals\n- Final tweet: Strong CTA — ask for a retweet, follow, or bookmark. Mention the original video as source.\n- Each tweet MUST be under 280 characters\n- Use 1-2 emojis per tweet max, never more\n- NO hashtags in the thread body, only 2-3 in the final tweet\n\nFormat each tweet as:\n**Tweet 1:**\n[content]\n\n**Tweet 2:**\n[content]\n\n...and so on.\n\nInsights:\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.8 },
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

  // ─── 12. 30 TikTok Hooks from One Topic ──────────────────────

  const wf12 = await prisma.workflow.create({
    data: {
      name: "30 TikTok Hooks from One Topic",
      description:
        "Enter any topic and instantly get 30 scroll-stopping TikTok hooks organized by style — curiosity, controversy, storytelling, authority, and more.",
      category: "CONTENT",
      priceInNolinks: 6,
      isPublic: true,
      slug: "tiktok-hooks-generator",
      tags: ["tiktok", "hooks", "viral", "content creation", "short-form", "social media"],
      creatorId: creator.id,
      totalUses: 487,
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
            name: "Research Hook Angles",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "You are a viral TikTok strategist. For the given topic, brainstorm hook angles across these 6 categories:\n\n1. **Curiosity Gap** — tease info they NEED to know\n2. **Controversy / Hot Take** — challenge common beliefs\n3. **Storytelling** — \"I just discovered...\" or \"The reason why...\"\n4. **Authority / Proof** — \"After 10 years of X, here's what I learned\"\n5. **Fear of Missing Out** — urgency, trends, \"before it's too late\"\n6. **Relatable / Humor** — \"POV:\" or \"Nobody talks about...\"\n\nFor each category, list 3-4 specific angles with brief notes on why they'd work.\n\nTopic: {{input}}",
            params: { max_tokens: 2048, temperature: 0.8 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate 30 Hooks",
            stepType: "BASIC",
            aiModel: "claude-4-sonnet",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Using these hook angles, write exactly 30 TikTok video hooks. Each hook is the first 3-5 seconds of a video — what the creator SAYS to stop the scroll.\n\nRules:\n- Each hook must be 1-2 sentences, conversational tone\n- Must create an open loop (viewer needs to keep watching)\n- Mix all 6 categories roughly evenly (5 per category)\n- Number them 1-30\n- After each hook, add a tag in brackets: [Curiosity], [Hot Take], [Story], [Authority], [FOMO], or [Relatable]\n- Make them feel natural, like someone talking to camera — NOT corporate or polished\n- Vary the energy: some calm/serious, some hype/excited, some shocked/whispering\n\nAt the end, add a section:\n\n## 🔥 Top 5 Picks (Highest Viral Potential)\nList the 5 strongest hooks with a one-line explanation of why each would perform.\n\nHook angles:\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.85 },
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

  // ─── 13. CV → Tailored Job Application ───────────────────────

  const wf13 = await prisma.workflow.create({
    data: {
      name: "CV → Tailored Job Application",
      description:
        "Paste your CV and the job description to get a tailored cover letter, optimized resume bullet points, and interview prep talking points.",
      category: "CONTENT",
      priceInNolinks: 10,
      isPublic: true,
      slug: "cv-to-job-application",
      tags: ["cv", "resume", "job application", "cover letter", "career", "interview"],
      creatorId: creator.id,
      totalUses: 312,
      steps: {
        create: [
          {
            order: 1,
            name: "User Input",
            stepType: "INPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            acceptTypes: ["text", "document"],
            positionX: 0,
            positionY: 100,
          },
          {
            order: 2,
            name: "Analyze & Match",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "You are a senior career coach and hiring consultant. Analyze the CV and job description provided below.\n\nProduce a structured analysis:\n\n## Skills Match\n- **Strong matches** — skills/experience that directly align\n- **Partial matches** — transferable skills that could apply\n- **Gaps** — requirements the candidate doesn't clearly meet\n\n## Key Achievements to Highlight\nIdentify 4-5 achievements from the CV that are most relevant to this role. Rewrite each as a STAR-format bullet point (Situation, Task, Action, Result) with quantified impact where possible.\n\n## Keywords to Include\nList ATS-friendly keywords from the job description that should appear in the application.\n\n## Tone & Culture Notes\nBased on the job description language, note the company culture and what tone the application should use.\n\nInput (CV + Job Description):\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.5 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Generate Application Pack",
            stepType: "BASIC",
            aiModel: "claude-4-sonnet",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Using the analysis below, create a complete tailored job application pack:\n\n## 1. Tailored Cover Letter\nWrite a compelling 3-paragraph cover letter:\n- Para 1: Hook — why you're excited about THIS specific role at THIS company\n- Para 2: Value proof — 2-3 specific achievements mapped to their requirements\n- Para 3: Close — enthusiasm + call to action\nKeep it under 300 words, professional but human.\n\n## 2. Optimized Resume Bullets\nRewrite the top 6 most relevant experience bullet points using:\n- Strong action verbs\n- Quantified results (%, $, time saved)\n- Keywords from the job description\n\n## 3. Interview Prep\n- **\"Tell me about yourself\" script** — 60-second elevator pitch for this role\n- **5 likely interview questions** based on the job description, with suggested talking points\n- **Questions to ask the interviewer** — 3 thoughtful questions that show research\n\nAnalysis:\n{{input}}",
            params: { max_tokens: 4096, temperature: 0.7 },
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

  // ─── 14. Cold Email Personalization at Scale ─────────────────

  const wf14 = await prisma.workflow.create({
    data: {
      name: "Cold Email Personalization at Scale",
      description:
        "Provide your product/service info and target prospect details to get highly personalized cold email sequences with subject lines, follow-ups, and A/B variants.",
      category: "MARKETING",
      priceInNolinks: 10,
      isPublic: true,
      slug: "cold-email-personalization",
      tags: ["cold email", "sales", "outreach", "personalization", "b2b", "marketing"],
      creatorId: creator.id,
      totalUses: 198,
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
            name: "Research & Strategy",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "You are a cold email strategist who has generated $50M+ in pipeline. Analyze the product/service and prospect information provided.\n\nProduce:\n\n## Prospect Pain Points\nBased on the prospect's role/industry, identify 3-4 likely pain points your product solves.\n\n## Personalization Hooks\nFind 3-4 angles for personalization:\n- Industry-specific challenges\n- Role-specific frustrations\n- Timely triggers (growth, hiring, funding, new regulation)\n- Competitive pressure\n\n## Value Proposition Mapping\nMap the product's features to the prospect's likely priorities. Frame each as outcome, not feature.\n\n## Objection Anticipation\nList the top 3 objections this prospect might have and a one-line reframe for each.\n\nInput:\n{{input}}",
            params: { max_tokens: 2048, temperature: 0.6 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Write Email Sequence",
            stepType: "BASIC",
            aiModel: "claude-4-sonnet",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Using the research below, write a complete cold email sequence.\n\nRules:\n- Under 120 words per email (short = higher reply rates)\n- No fluff, no \"I hope this finds you well\"\n- Every email must have ONE clear CTA\n- Sound like a human, not a template\n- Use lowercase subject lines (higher open rates)\n\n## Email 1 — Initial Outreach\n**Subject Line A:**\n**Subject Line B:** (A/B variant)\n**Body:**\n\n## Email 2 — Follow-up (3 days later)\n**Subject Line:**\n**Body:** (reference email 1, add new angle)\n\n## Email 3 — Breakup Email (5 days later)\n**Subject Line:**\n**Body:** (create subtle urgency, easy out)\n\n## LinkedIn Connection Note\nA short (300 char) LinkedIn message that complements the email sequence.\n\n## Performance Tips\n- Best send time for this persona\n- Recommended sending volume\n- Key metrics to track\n\nResearch:\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.75 },
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

  // ─── 15. PDF → Actionable Checklist ──────────────────────────

  const wf15 = await prisma.workflow.create({
    data: {
      name: "PDF → Actionable Checklist",
      description:
        "Upload any PDF — reports, guides, SOPs, research papers — and get a concise summary plus a step-by-step actionable checklist you can immediately execute.",
      category: "DATA",
      priceInNolinks: 8,
      isPublic: true,
      slug: "pdf-to-actionable-checklist",
      tags: ["pdf", "summary", "checklist", "productivity", "document", "actionable"],
      creatorId: creator.id,
      totalUses: 156,
      steps: {
        create: [
          {
            order: 1,
            name: "Upload PDF",
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
            name: "Deep Summarize",
            stepType: "BASIC",
            aiModel: "gpt-5.2-doc",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "You are an expert at distilling complex documents into actionable intelligence. Analyze this document thoroughly.\n\n## TL;DR\nOne paragraph (3-4 sentences) capturing the essence.\n\n## Key Facts & Figures\n- List every important number, stat, date, or metric mentioned\n\n## Main Arguments / Findings\nSummarize the 5-7 most important points. For each:\n- **Point:** one-sentence summary\n- **Evidence:** supporting data or reasoning\n- **Implication:** what this means practically\n\n## Decisions Required\nList any decisions, approvals, or choices the reader needs to make.\n\n## Raw Action Items\nExtract EVERY task, recommendation, next step, or suggestion mentioned — even implicit ones. List them all, we'll organize them next.\n\nDocument:\n{{input}}",
            params: { max_tokens: 4096 },
            positionX: 300,
            positionY: 100,
          },
          {
            order: 3,
            name: "Build Checklist",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Transform the summary and raw action items below into a polished, actionable output.\n\n## Executive Summary\nRewrite the TL;DR as a clean 2-3 sentence brief for busy executives.\n\n## Actionable Checklist\nOrganize all action items into a prioritized checklist:\n\n### 🔴 Do Immediately (This Week)\n- [ ] Action item with specific details\n- [ ] ...\n\n### 🟡 Do Soon (This Month)\n- [ ] ...\n\n### 🟢 Plan For Later\n- [ ] ...\n\n### 💡 Optional / Nice to Have\n- [ ] ...\n\nRules:\n- Each item must be specific and actionable (start with a verb)\n- Add context in parentheses where needed\n- Group related items together\n- Include deadlines or timeframes mentioned in the source\n- If responsibility is mentioned, note WHO should do it\n\nSummary & Action Items:\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.4 },
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

  // ─── 16. Voice Note → Structured Meeting Minutes ─────────────

  const wf16 = await prisma.workflow.create({
    data: {
      name: "Voice Note → Meeting Minutes",
      description:
        "Upload a voice memo or meeting recording and get professional meeting minutes with attendee notes, decisions, action items, and follow-up deadlines.",
      category: "AUDIO_VIDEO",
      priceInNolinks: 10,
      isPublic: true,
      slug: "voice-note-to-meeting-minutes",
      tags: ["voice note", "meeting", "minutes", "transcription", "productivity", "notes"],
      creatorId: creator.id,
      totalUses: 184,
      steps: {
        create: [
          {
            order: 1,
            name: "Upload Recording",
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
            positionX: 250,
            positionY: 100,
          },
          {
            order: 3,
            name: "Structure Minutes",
            stepType: "BASIC",
            aiModel: "gpt-4o",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "You are a professional executive assistant. Transform this raw meeting transcript into polished, structured meeting minutes.\n\n## Meeting Minutes\n\n### Overview\n- **Date:** [infer from context or put \"[Date]\"]\n- **Participants:** [identify speakers/names mentioned, or \"[Participants]\"]\n- **Duration:** [estimate from transcript length]\n- **Purpose:** [one-line meeting objective]\n\n### Agenda & Discussion\nOrganize the conversation into logical topics. For each:\n- **Topic:** clear heading\n- **Discussion:** 2-3 sentence summary of what was discussed\n- **Key Points:** bullet points of important details\n\n### Decisions Made\nList every decision with:\n- ✅ The decision\n- Rationale (brief)\n- Who approved / agreed\n\n### Action Items\n| # | Task | Owner | Deadline | Priority |\n|---|------|-------|----------|----------|\n| 1 | Specific task | Name | Date | High/Med/Low |\n\n### Open Questions / Parking Lot\n- Items raised but not resolved\n\n### Next Steps\n- Next meeting date/topic if mentioned\n- Follow-up actions\n\nTranscript:\n{{input}}",
            params: { max_tokens: 4096, temperature: 0.4 },
            positionX: 500,
            positionY: 100,
          },
          {
            order: 4,
            name: "Polish & Format",
            stepType: "BASIC",
            aiModel: "gpt-4o-mini",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt:
              "Review and polish these meeting minutes. Your job:\n\n1. Fix any formatting inconsistencies\n2. Ensure action items have clear owners and deadlines (mark as \"[TBD]\" if not mentioned)\n3. Add a one-paragraph **Executive Summary** at the very top for people who won't read the full minutes\n4. Add a **Follow-up Email Draft** at the bottom — a short email (under 150 words) that could be sent to attendees summarizing the meeting, highlighting their action items, and confirming the next meeting\n5. Ensure professional, concise language throughout\n\nMeeting Minutes:\n{{input}}",
            params: { max_tokens: 3000, temperature: 0.3 },
            positionX: 750,
            positionY: 100,
          },
          {
            order: 5,
            name: "Final Output",
            stepType: "OUTPUT",
            inputType: "TEXT",
            outputType: "TEXT",
            prompt: "",
            positionX: 1000,
            positionY: 100,
          },
        ],
      },
    },
  });

  const workflows = [wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8, wf9, wf10, wf11, wf12, wf13, wf14, wf15, wf16];

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
