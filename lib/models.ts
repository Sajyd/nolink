export type ModelCategory = "text" | "image" | "video" | "audio" | "document";
export type ModelProvider = "openai" | "anthropic" | "google" | "xai" | "meta" | "fal" | "elevenlabs" | "stability";

export interface ModelParam {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "textarea" | "file";
  default?: string | number | boolean;
  options?: { label: string; value: string }[];
  description?: string;
  min?: number;
  max?: number;
  required?: boolean;
  bindable?: boolean; // can be bound to a workflow input parameter
}

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  category: ModelCategory;
  costPerUse: number;
  description: string;
  params: ModelParam[];
  isFal?: boolean;
  falEndpoint?: string;
  comingSoon?: boolean;
  proOnly?: boolean;
  isCustom?: boolean;
}

// ─── Text Models ───────────────────────────────────────────────

export const TEXT_MODELS: AIModel[] = [
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    category: "text",
    costPerUse: 8,
    description: "OpenAI's most capable reasoning model",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 32000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 2 },
    ],
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    category: "text",
    costPerUse: 5,
    description: "Fast multimodal model with vision and text",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 16000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 2 },
    ],
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    category: "text",
    costPerUse: 1,
    description: "Fast and affordable for simple tasks",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 16000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 2 },
    ],
  },
  {
    id: "claude-4-opus",
    name: "Claude 4 Opus",
    provider: "anthropic",
    category: "text",
    costPerUse: 10,
    description: "Anthropic's most powerful model for complex reasoning",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 32000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 1 },
    ],
  },
  {
    id: "claude-4-sonnet",
    name: "Claude 4 Sonnet",
    provider: "anthropic",
    category: "text",
    costPerUse: 5,
    description: "Great balance of speed and intelligence",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 16000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 1 },
    ],
  },
  {
    id: "gemini-3",
    name: "Gemini 3",
    provider: "google",
    category: "text",
    costPerUse: 6,
    description: "Google's latest multimodal foundation model",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 32000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 2 },
    ],
  },
  {
    id: "grok-3",
    name: "Grok 3",
    provider: "xai",
    category: "text",
    costPerUse: 6,
    description: "xAI's latest conversational model with real-time knowledge",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 16000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 2 },
    ],
  },
  {
    id: "llama-4",
    name: "LLaMA 4",
    provider: "meta",
    category: "text",
    costPerUse: 3,
    description: "Meta's open-weight large language model",
    params: [
      { key: "prompt", label: "System Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 16000 },
      { key: "temperature", label: "Temperature", type: "number", default: 0.7, min: 0, max: 2 },
    ],
  },
];

// ─── Image Models ──────────────────────────────────────────────

export const IMAGE_MODELS: AIModel[] = [
  {
    id: "dall-e-3",
    name: "DALL·E 3",
    provider: "openai",
    category: "image",
    costPerUse: 8,
    description: "OpenAI's image generation model",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "size", label: "Size", type: "select", default: "1024x1024", options: [
        { label: "1024x1024", value: "1024x1024" },
        { label: "1792x1024", value: "1792x1024" },
        { label: "1024x1792", value: "1024x1792" },
      ]},
      { key: "quality", label: "Quality", type: "select", default: "standard", options: [
        { label: "Standard", value: "standard" },
        { label: "HD", value: "hd" },
      ]},
    ],
  },
  {
    id: "gpt-image-1",
    name: "GPT Image 1",
    provider: "openai",
    category: "image",
    costPerUse: 6,
    description: "OpenAI's native image generation in GPT",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "size", label: "Size", type: "select", default: "1024x1024", options: [
        { label: "1024x1024", value: "1024x1024" },
        { label: "1536x1024", value: "1536x1024" },
        { label: "1024x1536", value: "1024x1536" },
      ]},
    ],
  },
];

// ─── fal.ai Models ─────────────────────────────────────────────

export const FAL_IMAGE_MODELS: AIModel[] = [
  {
    id: "fal-nano-banana",
    name: "Nano Banana",
    provider: "fal",
    category: "image",
    costPerUse: 3,
    isFal: true,
    falEndpoint: "fal-ai/nano-banana",
    description: "Ultra-fast image generation with great quality",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "image_size", label: "Image Size", type: "select", default: "landscape_4_3", options: [
        { label: "Square (1:1)", value: "square" },
        { label: "Square HD", value: "square_hd" },
        { label: "Landscape 4:3", value: "landscape_4_3" },
        { label: "Landscape 16:9", value: "landscape_16_9" },
        { label: "Portrait 3:4", value: "portrait_3_4" },
        { label: "Portrait 9:16", value: "portrait_9_16" },
      ]},
      { key: "num_inference_steps", label: "Steps", type: "number", default: 30, min: 1, max: 50 },
      { key: "guidance_scale", label: "Guidance Scale", type: "number", default: 7.5, min: 1, max: 20 },
      { key: "seed", label: "Seed", type: "number", description: "Random seed for reproducibility" },
    ],
  },
  {
    id: "fal-nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "fal",
    category: "image",
    costPerUse: 5,
    isFal: true,
    falEndpoint: "fal-ai/nano-banana-pro",
    description: "Enhanced version with higher quality and more control",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "image_size", label: "Image Size", type: "select", default: "landscape_4_3", options: [
        { label: "Square (1:1)", value: "square" },
        { label: "Square HD", value: "square_hd" },
        { label: "Landscape 4:3", value: "landscape_4_3" },
        { label: "Landscape 16:9", value: "landscape_16_9" },
        { label: "Portrait 3:4", value: "portrait_3_4" },
        { label: "Portrait 9:16", value: "portrait_9_16" },
      ]},
      { key: "num_inference_steps", label: "Steps", type: "number", default: 40, min: 1, max: 100 },
      { key: "guidance_scale", label: "Guidance Scale", type: "number", default: 7.5, min: 1, max: 20 },
      { key: "seed", label: "Seed", type: "number", description: "Random seed for reproducibility" },
      { key: "enable_safety_checker", label: "Safety Filter", type: "boolean", default: true },
    ],
  },
  {
    id: "fal-flux-pro",
    name: "FLUX.1 Pro",
    provider: "fal",
    category: "image",
    costPerUse: 5,
    isFal: true,
    falEndpoint: "fal-ai/flux-pro",
    description: "State-of-the-art text-to-image by Black Forest Labs",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_size", label: "Image Size", type: "select", default: "landscape_4_3", options: [
        { label: "Square (1:1)", value: "square" },
        { label: "Square HD", value: "square_hd" },
        { label: "Landscape 4:3", value: "landscape_4_3" },
        { label: "Landscape 16:9", value: "landscape_16_9" },
        { label: "Portrait 3:4", value: "portrait_3_4" },
        { label: "Portrait 9:16", value: "portrait_9_16" },
      ]},
      { key: "num_inference_steps", label: "Steps", type: "number", default: 28, min: 1, max: 50 },
      { key: "guidance_scale", label: "Guidance Scale", type: "number", default: 3.5, min: 1, max: 20 },
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-stable-diffusion-xl",
    name: "Stable Diffusion XL",
    provider: "fal",
    category: "image",
    costPerUse: 3,
    isFal: true,
    falEndpoint: "fal-ai/stable-diffusion-xl",
    description: "High-quality open-source image generation",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "image_size", label: "Image Size", type: "select", default: "square_hd", options: [
        { label: "Square (1:1)", value: "square" },
        { label: "Square HD", value: "square_hd" },
        { label: "Landscape 4:3", value: "landscape_4_3" },
        { label: "Landscape 16:9", value: "landscape_16_9" },
        { label: "Portrait 3:4", value: "portrait_3_4" },
        { label: "Portrait 9:16", value: "portrait_9_16" },
      ]},
      { key: "num_inference_steps", label: "Steps", type: "number", default: 30, min: 1, max: 50 },
      { key: "guidance_scale", label: "Guidance Scale", type: "number", default: 7.5, min: 1, max: 20 },
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
];

// ─── Video Models ──────────────────────────────────────────────

export const FAL_VIDEO_MODELS: AIModel[] = [

  // ── Seedance (ByteDance) ────────────────────────────────────

  {
    id: "fal-seedance-1.5-pro-t2v",
    name: "Seedance 1.5 Pro — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 12,
    isFal: true,
    falEndpoint: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    description: "Dual-branch diffusion with synchronized audio-video generation (720p)",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "4s", value: "4" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "12s", value: "12" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
        { label: "4:3", value: "4:3" },
        { label: "3:4", value: "3:4" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-seedance-1.5-pro-i2v",
    name: "Seedance 1.5 Pro — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 12,
    isFal: true,
    falEndpoint: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    description: "Animate images with start/end frame support and lip-sync audio",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "4s", value: "4" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "12s", value: "12" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-seedance-1.5-fast-t2v",
    name: "Seedance 1.5 Fast — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 8,
    isFal: true,
    falEndpoint: "fal-ai/bytedance/seedance/v1/pro/fast/text-to-video",
    description: "Fast and affordable video generation (up to 1080p)",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "2s", value: "2" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "12s", value: "12" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "21:9", value: "21:9" },
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
        { label: "4:3", value: "4:3" },
        { label: "3:4", value: "3:4" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-seedance-2.0",
    name: "Seedance 2.0",
    provider: "fal",
    category: "video",
    costPerUse: 25,
    isFal: true,
    comingSoon: true,
    falEndpoint: "fal-ai/bytedance/seedance/v2/pro/text-to-video",
    description: "Next-gen cinematic audio-video with director-level camera control — Coming Feb 24",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "5s", value: "5" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ]},
    ],
  },

  // ── Kling 3 / V3 (Kuaishou) ─────────────────────────────────

  {
    id: "fal-kling-v3-t2v",
    name: "Kling 3 — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 18,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v3/standard/text-to-video",
    description: "Multi-shot storyboarding with native audio and 1080p output",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "3s", value: "3" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-kling-v3-i2v",
    name: "Kling 3 — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 18,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    description: "Animate images with element referencing and native audio",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "3s", value: "3" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-kling-v3-pro-t2v",
    name: "Kling 3 Pro — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 25,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v3/pro/text-to-video",
    description: "Pro-tier Kling 3 with enhanced detail, audio, and multi-shot",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "3s", value: "3" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-kling-v3-pro-i2v",
    name: "Kling 3 Pro — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 25,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    description: "Pro-tier image-to-video with custom element support and audio",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "3s", value: "3" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },

  // ── Kling O3 Omni (Kuaishou) ────────────────────────────────

  {
    id: "fal-kling-o3-std-t2v",
    name: "Kling O3 Standard — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 18,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/o3/standard/text-to-video",
    description: "Omni model with multi-image elements and native audio ($0.17/s)",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "3s", value: "3" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-kling-o3-pro-t2v",
    name: "Kling O3 Pro — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 25,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/o3/pro/text-to-video",
    description: "Pro omni model with multi-character coreference and voice input",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "3s", value: "3" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-kling-o3-pro-i2v",
    name: "Kling O3 Pro — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 25,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/o3/pro/image-to-video",
    description: "Pro omni image-to-video with 1080p output and native audio",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "3s", value: "3" },
        { label: "5s", value: "5" },
        { label: "8s", value: "8" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-kling-o3-pro-v2v",
    name: "Kling O3 Pro — Video Editing",
    provider: "fal",
    category: "video",
    costPerUse: 30,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/o3/pro/video-to-video/edit",
    description: "Edit videos with text prompts — element replacement and style changes",
    params: [
      { key: "prompt", label: "Edit Prompt", type: "textarea", required: true, bindable: true },
      { key: "video_url", label: "Input Video URL", type: "text", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
    ],
  },

  // ── Kling 2.5 Turbo (Kuaishou) ──────────────────────────────

  {
    id: "fal-kling-2.5-turbo-t2v",
    name: "Kling 2.5 Turbo — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 10,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v2.5-turbo/standard/text-to-video",
    description: "Fast video gen with smooth motion and robust camera control",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "5s", value: "5" },
        { label: "10s", value: "10" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ]},
    ],
  },
  {
    id: "fal-kling-2.5-turbo-i2v",
    name: "Kling 2.5 Turbo — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 10,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v2.5-turbo/standard/image-to-video",
    description: "Affordable image-to-video with temporal consistency",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "5s", value: "5" },
        { label: "10s", value: "10" },
      ]},
    ],
  },

  // ── Kling 1.6 Legacy (Kuaishou) ─────────────────────────────

  {
    id: "fal-kling-1.6-t2v",
    name: "Kling 1.6 — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 15,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v1.6/standard/text-to-video",
    description: "Reliable video generation with motion control",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "5", options: [
        { label: "5s", value: "5" },
        { label: "10s", value: "10" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ]},
    ],
  },
  {
    id: "fal-kling-1.6-pro-i2v",
    name: "Kling 1.6 Pro — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 20,
    isFal: true,
    falEndpoint: "fal-ai/kling-video/v1.6/pro/image-to-video",
    description: "Image-to-video with precise motion control",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration", type: "select", default: "5", options: [
        { label: "5s", value: "5" },
        { label: "10s", value: "10" },
      ]},
    ],
  },

  // ── Sora 2 (OpenAI) ─────────────────────────────────────────

  {
    id: "fal-sora-2-t2v",
    name: "Sora 2 — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 15,
    isFal: true,
    falEndpoint: "fal-ai/sora-2/text-to-video",
    description: "OpenAI's video generation with audio ($0.10/s)",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "8", options: [
        { label: "4s", value: "4" },
        { label: "8s", value: "8" },
        { label: "12s", value: "12" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "Auto", value: "auto" },
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ]},
      { key: "resolution", label: "Resolution", type: "select", default: "auto", options: [
        { label: "Auto", value: "auto" },
        { label: "720p", value: "720p" },
      ]},
    ],
  },
  {
    id: "fal-sora-2-i2v",
    name: "Sora 2 — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 15,
    isFal: true,
    falEndpoint: "fal-ai/sora-2/image-to-video",
    description: "Animate images into video with OpenAI Sora 2",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "8", options: [
        { label: "4s", value: "4" },
        { label: "8s", value: "8" },
        { label: "12s", value: "12" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "Auto", value: "auto" },
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ]},
    ],
  },
  {
    id: "fal-sora-2-v2v",
    name: "Sora 2 — Video Remix",
    provider: "fal",
    category: "video",
    costPerUse: 15,
    isFal: true,
    falEndpoint: "fal-ai/sora-2/video-to-video/remix",
    description: "Transform existing videos with style changes and creative edits",
    params: [
      { key: "prompt", label: "Edit Prompt", type: "textarea", required: true, bindable: true },
      { key: "video_url", label: "Input Video URL", type: "text", required: true, bindable: true },
    ],
  },
  {
    id: "fal-sora-2-pro-t2v",
    name: "Sora 2 Pro — Text to Video",
    provider: "fal",
    category: "video",
    costPerUse: 25,
    isFal: true,
    falEndpoint: "fal-ai/sora-2/text-to-video/pro",
    description: "Premium-quality Sora 2 with higher fidelity output",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "8", options: [
        { label: "4s", value: "4" },
        { label: "8s", value: "8" },
        { label: "12s", value: "12" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "Auto", value: "auto" },
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ]},
      { key: "resolution", label: "Resolution", type: "select", default: "auto", options: [
        { label: "Auto", value: "auto" },
        { label: "720p", value: "720p" },
      ]},
    ],
  },
  {
    id: "fal-sora-2-pro-i2v",
    name: "Sora 2 Pro — Image to Video",
    provider: "fal",
    category: "video",
    costPerUse: 25,
    isFal: true,
    falEndpoint: "fal-ai/sora-2/image-to-video/pro",
    description: "Premium image-to-video with Sora 2 Pro quality",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", required: true, bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "select", default: "8", options: [
        { label: "4s", value: "4" },
        { label: "8s", value: "8" },
        { label: "12s", value: "12" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "Auto", value: "auto" },
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ]},
    ],
  },

  // ── Other ───────────────────────────────────────────────────

  {
    id: "fal-veo-3.1",
    name: "Veo 3.1",
    provider: "fal",
    category: "video",
    costPerUse: 22,
    isFal: true,
    falEndpoint: "fal-ai/veo3",
    description: "Google's high-fidelity video generation model",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration", type: "select", default: "4", options: [
        { label: "4s", value: "4" },
        { label: "8s", value: "8" },
      ]},
      { key: "aspect_ratio", label: "Aspect Ratio", type: "select", default: "16:9", options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
        { label: "4:3", value: "4:3" },
      ]},
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
  {
    id: "fal-runway-gen3",
    name: "Runway Gen-3 Alpha",
    provider: "fal",
    category: "video",
    costPerUse: 20,
    isFal: true,
    falEndpoint: "fal-ai/runway-gen3/turbo/image-to-video",
    description: "Professional video generation from text or images",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "image_url", label: "Input Image URL", type: "text", bindable: true },
      { key: "duration", label: "Duration", type: "select", default: "5", options: [
        { label: "5s", value: "5" },
        { label: "10s", value: "10" },
      ]},
    ],
  },
];

// ─── Custom fal.ai Model (Pro users only) ─────────────────────

export const CUSTOM_FAL_MODEL: AIModel = {
  id: "fal-custom",
  name: "Custom fal.ai Model / Workflow",
  provider: "fal",
  category: "video",
  costPerUse: 0,
  isFal: true,
  isCustom: true,
  proOnly: true,
  description: "Enter any fal.ai model endpoint and configure parameters manually",
  params: [],
};

// ─── Audio Models ──────────────────────────────────────────────

export const AUDIO_MODELS: AIModel[] = [
  {
    id: "whisper-1",
    name: "OpenAI Whisper",
    provider: "openai",
    category: "audio",
    costPerUse: 3,
    description: "Speech-to-text transcription",
    params: [
      { key: "audio_url", label: "Audio URL", type: "text", required: true, bindable: true },
      { key: "language", label: "Language", type: "select", default: "en", options: [
        { label: "English", value: "en" },
        { label: "Spanish", value: "es" },
        { label: "French", value: "fr" },
        { label: "German", value: "de" },
        { label: "Auto-detect", value: "" },
      ]},
    ],
  },
  {
    id: "openai-tts-1-hd",
    name: "OpenAI TTS HD",
    provider: "openai",
    category: "audio",
    costPerUse: 4,
    description: "High-definition text-to-speech",
    params: [
      { key: "input", label: "Text to Speak", type: "textarea", required: true, bindable: true },
      { key: "voice", label: "Voice", type: "select", default: "alloy", options: [
        { label: "Alloy", value: "alloy" },
        { label: "Echo", value: "echo" },
        { label: "Fable", value: "fable" },
        { label: "Onyx", value: "onyx" },
        { label: "Nova", value: "nova" },
        { label: "Shimmer", value: "shimmer" },
      ]},
      { key: "speed", label: "Speed", type: "number", default: 1.0, min: 0.25, max: 4.0 },
    ],
  },
  {
    id: "elevenlabs-tts",
    name: "ElevenLabs TTS",
    provider: "elevenlabs",
    category: "audio",
    costPerUse: 5,
    description: "Premium text-to-speech with natural voices",
    params: [
      { key: "text", label: "Text to Speak", type: "textarea", required: true, bindable: true },
      { key: "voice_id", label: "Voice", type: "select", default: "rachel", options: [
        { label: "Rachel", value: "rachel" },
        { label: "Adam", value: "adam" },
        { label: "Antoni", value: "antoni" },
        { label: "Bella", value: "bella" },
        { label: "Domi", value: "domi" },
        { label: "Elli", value: "elli" },
      ]},
      { key: "stability", label: "Stability", type: "number", default: 0.5, min: 0, max: 1 },
      { key: "similarity_boost", label: "Similarity", type: "number", default: 0.75, min: 0, max: 1 },
    ],
  },
  {
    id: "fal-audio-gen",
    name: "Stable Audio",
    provider: "fal",
    category: "audio",
    costPerUse: 4,
    isFal: true,
    falEndpoint: "fal-ai/stable-audio",
    description: "AI music and sound effect generation",
    params: [
      { key: "prompt", label: "Prompt", type: "textarea", required: true, bindable: true },
      { key: "negative_prompt", label: "Negative Prompt", type: "textarea", bindable: true },
      { key: "duration", label: "Duration (seconds)", type: "number", default: 10, min: 1, max: 47 },
      { key: "seed", label: "Seed", type: "number" },
    ],
  },
];

// ─── Document Models ───────────────────────────────────────────

export const DOCUMENT_MODELS: AIModel[] = [
  {
    id: "gpt-5.2-doc",
    name: "GPT-5.2 Document",
    provider: "openai",
    category: "document",
    costPerUse: 8,
    description: "Analyze documents, extract info, generate reports",
    params: [
      { key: "prompt", label: "Analysis Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 32000 },
    ],
  },
  {
    id: "gemini-3-doc",
    name: "Gemini 3 Document",
    provider: "google",
    category: "document",
    costPerUse: 6,
    description: "Google's multimodal document understanding",
    params: [
      { key: "prompt", label: "Analysis Prompt", type: "textarea", required: true, bindable: true },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 1, max: 32000 },
    ],
  },
];

// ─── All Models ────────────────────────────────────────────────

export const ALL_MODELS: AIModel[] = [
  ...TEXT_MODELS,
  ...IMAGE_MODELS,
  ...FAL_IMAGE_MODELS,
  ...FAL_VIDEO_MODELS,
  ...AUDIO_MODELS,
  ...DOCUMENT_MODELS,
  CUSTOM_FAL_MODEL,
];

export function getModelById(id: string): AIModel | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}

export function getModelsByCategory(category: ModelCategory): AIModel[] {
  return ALL_MODELS.filter((m) => m.category === category);
}

export function getFalModels(): AIModel[] {
  return ALL_MODELS.filter((m) => m.isFal && !m.isCustom);
}

export function getCustomFalModel(): AIModel {
  return CUSTOM_FAL_MODEL;
}

export function getBasicModels(): AIModel[] {
  return ALL_MODELS.filter((m) => !m.isFal);
}

export function estimateCostFromModels(modelIds: string[]): number {
  return modelIds.reduce((sum, id) => {
    const model = getModelById(id);
    return sum + (model?.costPerUse ?? 2);
  }, 0);
}

export const NODE_TYPES = {
  INPUT: "inputNode",
  OUTPUT: "outputNode",
  BASIC: "basicNode",
  FAL_AI: "falAiNode",
} as const;

export type NodeType = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];

export const INPUT_ACCEPT_TYPES = [
  { id: "text", label: "Text", description: "Plain text, prompt, or message" },
  { id: "image", label: "Image", description: "JPEG, PNG, WebP file" },
  { id: "video", label: "Video", description: "MP4, WebM file" },
  { id: "audio", label: "Audio", description: "MP3, WAV, M4A file" },
  { id: "document", label: "Document", description: "PDF, DOCX, TXT file" },
] as const;
