import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { getModelById, estimateCostFromModels, type AIModel } from "./models";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
}

function getXaiClient(): OpenAI | null {
  const key = process.env.XAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" });
}

export interface FileInput {
  url: string;
  type: string;
  name: string;
  mimeType?: string;
}

export interface StepDefinition {
  id: string;
  order: number;
  name: string;
  stepType: string;
  aiModel: string | null;
  inputType: string;
  outputType: string;
  prompt: string;
  config?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
  acceptTypes?: string[];
}

export interface StepResult {
  stepId: string;
  stepName: string;
  stepType: string;
  output: string;
  outputType: string;
  tokensUsed?: number;
  duration: number;
}

interface StepInput {
  text: string;
  files: FileInput[];
}

export function estimateWorkflowCost(steps: StepDefinition[]): number {
  const modelIds = steps.filter((s) => s.aiModel).map((s) => s.aiModel!);
  return estimateCostFromModels(modelIds);
}

function resolveFileUrl(fileUrl: string): string {
  if (fileUrl.startsWith("http")) return fileUrl;
  if (fileUrl.startsWith("/uploads/")) {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return `${baseUrl}${fileUrl}`;
  }
  return fileUrl;
}

function fileToBase64(fileUrl: string): string | null {
  if (!fileUrl.startsWith("/uploads/")) return null;
  const filePath = path.join(process.cwd(), "public", fileUrl);
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
}

function getFilesByType(files: FileInput[], type: string): FileInput[] {
  return files.filter((f) => f.type === type);
}

function ensureUploadsDir(): string {
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const OPENAI_MODEL_MAP: Record<string, string> = {
  "gpt-5.2": "gpt-4o",
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-5.2-doc": "gpt-4o",
  "gemini-3-doc": "gpt-4o",
  "claude-4-opus": "gpt-4o",
  "claude-4-sonnet": "gpt-4o",
  "gemini-3": "gpt-4o",
  "grok-3": "gpt-4o",
  "llama-4": "gpt-4o-mini",
};

function resolveOpenAIFallbackModel(modelId: string): string {
  return OPENAI_MODEL_MAP[modelId] || "gpt-4o";
}

// ── Provider-specific text generation ───────────────────────────

async function generateWithAnthropic(
  systemPrompt: string,
  userMessage: string,
  params: Record<string, unknown>,
  modelId: string
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const claudeModel =
    modelId === "claude-4-opus"
      ? "claude-sonnet-4-20250514"
      : "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: claudeModel,
      max_tokens: (params.max_tokens as number) || 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Anthropic API error: ${err}`);
    return null;
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

async function generateWithGemini(
  systemPrompt: string,
  userMessage: string,
  params: Record<string, unknown>
): Promise<string | null> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: (params.max_tokens as number) || 4096,
          temperature: (params.temperature as number) || 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error(`Gemini API error: ${err}`);
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function generateWithXai(
  systemPrompt: string,
  userMessage: string,
  params: Record<string, unknown>
): Promise<string | null> {
  const client = getXaiClient();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: "grok-3",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: (params.max_tokens as number) || 4096,
    temperature: (params.temperature as number) || 0.7,
  });

  return response.choices[0]?.message?.content || "";
}

async function generateTextWithOpenAI(
  systemPrompt: string,
  userMessage: string,
  params: Record<string, unknown>,
  modelId: string,
  imageFiles: FileInput[]
): Promise<string> {
  const openai = getOpenAI();
  const apiModel = resolveOpenAIFallbackModel(modelId);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  if (imageFiles.length > 0) {
    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: userMessage || "Analyze this image." },
    ];
    for (const img of imageFiles) {
      const base64 = fileToBase64(img.url);
      if (base64 && img.mimeType) {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${base64}` },
        });
      } else {
        contentParts.push({
          type: "image_url",
          image_url: { url: resolveFileUrl(img.url) },
        });
      }
    }
    messages.push({ role: "user", content: contentParts });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const response = await openai.chat.completions.create({
    model: apiModel,
    messages,
    max_tokens: (params.max_tokens as number) || 4096,
    temperature: (params.temperature as number) || 0.7,
  });

  return response.choices[0]?.message?.content || "";
}

// ── Audio executors ─────────────────────────────────────────────

async function executeWhisperStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  const audioFiles = getFilesByType(input.files, "audio");
  if (audioFiles.length === 0) {
    return { text: "No audio file provided for transcription.", files: [] };
  }

  const audioFile = audioFiles[0];

  if (audioFile.url.startsWith("/uploads/")) {
    const localPath = path.join(process.cwd(), "public", audioFile.url);
    if (fs.existsSync(localPath)) {
      const openai = getOpenAI();
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(localPath) as any,
        language: (step.params?.language as string) || undefined,
      });
      return { text: transcription.text, files: [] };
    }
  }

  if (audioFile.url.startsWith("http")) {
    const resp = await fetch(audioFile.url);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const tmpPath = path.join(ensureUploadsDir(), `whisper-tmp-${Date.now()}.mp3`);
    fs.writeFileSync(tmpPath, buffer);

    try {
      const openai = getOpenAI();
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(tmpPath) as any,
        language: (step.params?.language as string) || undefined,
      });
      return { text: transcription.text, files: [] };
    } finally {
      fs.unlinkSync(tmpPath);
    }
  }

  return { text: "Could not access audio file for transcription.", files: [] };
}

async function executeOpenAITtsStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  const textToSpeak = input.text || (step.params?.input as string) || "";
  if (!textToSpeak) return { text: "No text provided for speech generation.", files: [] };

  const openai = getOpenAI();
  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: ((step.params?.voice as string) || "alloy") as any,
    input: textToSpeak.slice(0, 4096),
    speed: (step.params?.speed as number) || 1.0,
  });

  const dir = ensureUploadsDir();
  const fileName = `tts-${Date.now()}.mp3`;
  const filePath = path.join(dir, fileName);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const url = `/uploads/${fileName}`;
  return { text: url, files: [{ url, type: "audio", name: fileName }] };
}

async function executeElevenLabsTtsStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  const key = process.env.ELEVENLABS_API_KEY;
  const textToSpeak = input.text || (step.params?.text as string) || "";
  if (!textToSpeak) return { text: "No text provided for speech generation.", files: [] };

  if (!key) {
    return executeOpenAITtsStep(step, { ...input, text: textToSpeak });
  }

  const voiceId = (step.params?.voice_id as string) || "rachel";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textToSpeak,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: (step.params?.stability as number) || 0.5,
          similarity_boost: (step.params?.similarity_boost as number) || 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error(`ElevenLabs error: ${err}`);
    return executeOpenAITtsStep(step, { ...input, text: textToSpeak });
  }

  const dir = ensureUploadsDir();
  const fileName = `elevenlabs-${Date.now()}.mp3`;
  const filePath = path.join(dir, fileName);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const url = `/uploads/${fileName}`;
  return { text: url, files: [{ url, type: "audio", name: fileName }] };
}

// ── Step executors by type ──────────────────────────────────────

async function executeInputStep(
  _step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  return input;
}

async function executeOutputStep(
  _step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  return input;
}

async function executeBasicStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  if (!step.aiModel) return input;

  const model = getModelById(step.aiModel);
  if (!model) return { text: `[Unknown model: ${step.aiModel}] ${input.text.slice(0, 200)}`, files: [] };

  const promptText = step.prompt
    ? step.prompt.replace(/\{\{input\}\}/g, input.text)
    : input.text;

  const params = (step.params || {}) as Record<string, unknown>;

  // ── Text & Document models ──
  if (model.category === "text" || model.category === "document") {
    let result: string | null = null;

    if (model.provider === "anthropic") {
      result = await generateWithAnthropic(promptText, input.text, params, step.aiModel);
    } else if (model.provider === "google") {
      result = await generateWithGemini(promptText, input.text, params);
    } else if (model.provider === "xai") {
      result = await generateWithXai(promptText, input.text, params);
    }

    if (result === null) {
      const imageFiles = getFilesByType(input.files, "image");
      result = await generateTextWithOpenAI(
        promptText,
        input.text,
        params,
        step.aiModel,
        imageFiles
      );
    }

    return { text: result, files: [] };
  }

  // ── Image generation ──
  if (model.category === "image") {
    const openai = getOpenAI();

    if (step.aiModel === "gpt-image-1") {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: promptText,
        n: 1,
        size: ((params.size as string) || "1024x1024") as any,
      });

      let url = response.data?.[0]?.url || "";
      if (!url && response.data?.[0]?.b64_json) {
        const dir = ensureUploadsDir();
        const fileName = `gpt-img-${Date.now()}.png`;
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, Buffer.from(response.data[0].b64_json, "base64"));
        url = `/uploads/${fileName}`;
      }
      return { text: url, files: url ? [{ url, type: "image", name: "generated.png" }] : [] };
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: promptText,
      n: 1,
      size: ((params.size as string) || "1024x1024") as any,
      quality: ((params.quality as string) || "standard") as any,
    });
    const url = response.data?.[0]?.url || "";
    return { text: url, files: url ? [{ url, type: "image", name: "generated.png" }] : [] };
  }

  // ── Audio models ──
  if (model.category === "audio") {
    if (step.aiModel === "whisper-1") {
      return executeWhisperStep(step, input);
    }
    if (step.aiModel === "openai-tts-1-hd") {
      return executeOpenAITtsStep(step, input);
    }
    if (step.aiModel === "elevenlabs-tts") {
      return executeElevenLabsTtsStep(step, input);
    }
  }

  return { text: `[${model.name}] Processed: "${input.text.slice(0, 200)}"`, files: [] };
}

async function executeFalStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  if (!step.aiModel) return input;

  const model = getModelById(step.aiModel);
  if (!model || !model.isFal) return { text: `[Unknown fal model: ${step.aiModel}]`, files: [] };

  const resolvedParams: Record<string, unknown> = {};
  if (step.params) {
    for (const [key, val] of Object.entries(step.params)) {
      if (typeof val === "string" && val.includes("{{input}}")) {
        resolvedParams[key] = val.replace(/\{\{input\}\}/g, input.text);
      } else {
        resolvedParams[key] = val;
      }
    }
  }

  if (!resolvedParams.prompt && step.prompt) {
    resolvedParams.prompt = step.prompt.replace(/\{\{input\}\}/g, input.text);
  }

  const imageFiles = getFilesByType(input.files, "image");
  const audioFiles = getFilesByType(input.files, "audio");
  const videoFiles = getFilesByType(input.files, "video");

  if (imageFiles.length > 0 && !resolvedParams.image_url) {
    resolvedParams.image_url = resolveFileUrl(imageFiles[0].url);
  }
  if (audioFiles.length > 0 && !resolvedParams.audio_url) {
    resolvedParams.audio_url = resolveFileUrl(audioFiles[0].url);
  }
  if (videoFiles.length > 0 && !resolvedParams.video_url) {
    resolvedParams.video_url = resolveFileUrl(videoFiles[0].url);
  }

  if (process.env.FAL_KEY) {
    try {
      const response = await fetch(`https://fal.run/${model.falEndpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resolvedParams),
      });

      if (!response.ok) {
        const err = await response.text();
        return { text: `[fal.ai error: ${err.slice(0, 200)}]`, files: [] };
      }

      const result = await response.json();

      if (result.images?.[0]?.url) {
        const url = result.images[0].url;
        return { text: url, files: [{ url, type: "image", name: "generated.png" }] };
      }
      if (result.image?.url) {
        const url = result.image.url;
        return { text: url, files: [{ url, type: "image", name: "generated.png" }] };
      }
      if (result.video?.url) {
        const url = result.video.url;
        return { text: url, files: [{ url, type: "video", name: "generated.mp4" }] };
      }
      if (result.audio?.url) {
        const url = result.audio.url;
        return { text: url, files: [{ url, type: "audio", name: "generated.mp3" }] };
      }
      if (result.audio_file?.url) {
        const url = result.audio_file.url;
        return { text: url, files: [{ url, type: "audio", name: "generated.mp3" }] };
      }
      if (result.output) {
        const out = typeof result.output === "string" ? result.output : JSON.stringify(result.output);
        return { text: out, files: [] };
      }

      return { text: JSON.stringify(result), files: [] };
    } catch (err) {
      return { text: `[fal.ai error: ${err instanceof Error ? err.message : "Unknown"}]`, files: [] };
    }
  }

  const category = model.category;
  if (category === "image") {
    const url = `https://placehold.co/1024x1024/f59e0b/white?text=${encodeURIComponent(model.name)}`;
    return { text: url, files: [{ url, type: "image", name: "generated.png" }] };
  }
  if (category === "video") {
    return { text: `[${model.name} video – no FAL_KEY configured]`, files: [] };
  }
  if (category === "audio") {
    return { text: `[${model.name} audio – no FAL_KEY configured]`, files: [] };
  }
  return { text: `[${model.name}] ${(resolvedParams.prompt as string || input.text).slice(0, 200)}`, files: [] };
}

// ── Main execution ──────────────────────────────────────────────

export async function executeStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepResult & { _nextInput: StepInput }> {
  const start = Date.now();

  let stepOutput: StepInput;
  try {
    switch (step.stepType) {
      case "INPUT":
        stepOutput = await executeInputStep(step, input);
        break;
      case "OUTPUT":
        stepOutput = await executeOutputStep(step, input);
        break;
      case "FAL_AI":
        stepOutput = await executeFalStep(step, input);
        break;
      case "BASIC":
      default:
        stepOutput = await executeBasicStep(step, input);
        break;
    }
  } catch (error) {
    stepOutput = { text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`, files: [] };
  }

  return {
    stepId: step.id,
    stepName: step.name,
    stepType: step.stepType,
    output: stepOutput.text,
    outputType: step.outputType,
    duration: Date.now() - start,
    _nextInput: stepOutput,
  };
}

export async function executeWorkflow(
  steps: StepDefinition[],
  initialInput: string,
  files: FileInput[] = []
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  let currentInput: StepInput = { text: initialInput, files };

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (const step of sortedSteps) {
    const result = await executeStep(step, currentInput);
    const { _nextInput, ...stepResult } = result;
    results.push(stepResult);
    currentInput = _nextInput;
  }

  return results;
}
