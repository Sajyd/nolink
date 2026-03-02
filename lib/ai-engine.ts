import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
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

export interface StepCustomParam {
  name: string;
  value: string;
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
  systemPrompt?: string;
  config?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
  acceptTypes?: string[];
  fileBindings?: string[];
  customParams?: StepCustomParam[];
  customFalEndpoint?: string;
  customFalParams?: { key: string; value: string }[];
  customFalPrice?: number;
  customReplicateModel?: string;
  customReplicateParams?: { key: string; value: string }[];
  customReplicatePrice?: number;
  customApiUrl?: string;
  customApiMethod?: string;
  customApiHeaders?: { key: string; value: string }[];
  customApiParams?: { key: string; value: string }[];
  customApiResultFields?: { key: string; type: string }[];
  customApiPrice?: number;
  logicMode?: string;
  logicCondition?: {
    leftOperand: string;
    operator: string;
    rightOperand: string;
  };
  utilityConfig?: {
    operation: string;
    operand?: string;
    replacement?: string;
    delimiter?: string;
    itemTemplate?: string;
    joinWith?: string;
  };
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
  const apiCost = steps
    .filter((s) => s.stepType === "CUSTOM_API")
    .reduce((sum, s) => sum + (s.customApiPrice || 0), 0);
  const customFalCost = steps
    .filter((s) => s.aiModel === "fal-custom")
    .reduce((sum, s) => sum + (s.customFalPrice || 0), 0);
  const customReplicateCost = steps
    .filter((s) => s.aiModel === "rep-custom")
    .reduce((sum, s) => sum + (s.customReplicatePrice || 0), 0);
  return estimateCostFromModels(modelIds) + apiCost + customFalCost + customReplicateCost;
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

async function resolveMediaUrl(fileUrl: string): Promise<string> {
  console.log(`[media] resolveMediaUrl input: ${fileUrl.slice(0, 120)}`);

  if (isS3Url(fileUrl)) {
    const parsed = parseS3Url(fileUrl);
    const key = parsed?.key || extractS3Key(fileUrl);
    console.log(`[media] S3 URL detected, bucket=${parsed?.bucket}, region=${parsed?.region}, key=${key}`);
    if (key) {
      try {
        const presigned = await presignS3Key(key, parsed?.bucket, parsed?.region);
        if (presigned) {
          console.log(`[media] Presigned OK (${presigned.slice(0, 80)}...)`);
          return presigned;
        }
        console.warn(`[media] presignS3Key returned null for key: ${key}`);
      } catch (err) {
        console.error(`[media] presignS3Key failed for key ${key}:`, err);
      }
    }
  }

  const mediaKey = extractMediaS3Key(fileUrl);
  if (mediaKey) {
    console.log(`[media] /api/media URL detected, S3 key: ${mediaKey}`);
    try {
      const presigned = await presignS3Key(mediaKey);
      if (presigned) {
        console.log(`[media] Presigned OK`);
        return presigned;
      }
      console.warn(`[media] presignS3Key returned null for media key: ${mediaKey}`);
    } catch (err) {
      console.error(`[media] presignS3Key failed for media key ${mediaKey}:`, err);
    }
  }

  if (fileUrl.startsWith("/uploads/")) {
    const s3Key = fileUrl.slice(1);
    console.log(`[media] Local path, trying S3 key: ${s3Key}`);
    try {
      const presigned = await presignS3Key(s3Key);
      if (presigned) {
        console.log(`[media] Presigned OK`);
        return presigned;
      }
      console.warn(`[media] presignS3Key returned null for local key: ${s3Key}`);
    } catch (err) {
      console.error(`[media] presignS3Key failed for local key ${s3Key}:`, err);
    }
    return resolveFileUrl(fileUrl);
  }

  console.log(`[media] URL not resolved, returning as-is: ${fileUrl.slice(0, 120)}`);
  return fileUrl;
}

function getFilesByType(files: FileInput[], type: string): FileInput[] {
  return files.filter((f) => f.type === type);
}

async function buildDocSuffix(documentFiles: FileInput[]): Promise<string> {
  if (documentFiles.length === 0) return "";
  const docTexts = await Promise.all(
    documentFiles.map(async (f) => {
      const content = await fetchDocumentText(f.url);
      return `--- Document: ${f.name || f.url} ---\n${content}`;
    })
  );
  return "\n\n" + docTexts.join("\n\n");
}

// ── fal.ai file URL resolution ──────────────────────────────────
// S3 "public" URLs are not actually public; fal.ai cannot download them.
// For S3 files we generate a short-lived presigned GET URL.
// For local /uploads/ files we push the bytes into fal.ai's own storage.

function isS3Url(url: string): boolean {
  return /\.s3[.\-].*amazonaws\.com/.test(url);
}

function extractS3Key(url: string): string | null {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    return null;
  }
}

function parseS3Url(url: string): { bucket: string; region: string; key: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const m = host.match(/^(.+)\.s3[.\-]([a-z0-9-]+)\.amazonaws\.com$/);
    if (m) {
      return {
        bucket: m[1],
        region: m[2],
        key: decodeURIComponent(parsed.pathname.slice(1)),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function uploadToFalStorage(
  fileBuffer: Buffer,
  contentType: string,
  fileName: string
): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error("FAL_KEY not configured");

  const initResp = await fetch(
    "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
    {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content_type: contentType,
        file_name: fileName,
      }),
    }
  );

  if (!initResp.ok) {
    throw new Error(`fal.ai upload initiate failed: ${await initResp.text()}`);
  }

  const { file_url, upload_url } = (await initResp.json()) as {
    file_url: string;
    upload_url: string;
  };

  const putResp = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileBuffer,
  });

  if (!putResp.ok) {
    throw new Error(`fal.ai file upload failed: ${putResp.status}`);
  }

  return file_url;
}

function extractMediaS3Key(url: string): string | null {
  const match = url.match(/\/api\/media\/(results\/.+)$/);
  return match ? match[1] : null;
}

async function presignS3Key(
  key: string,
  overrideBucket?: string,
  overrideRegion?: string
): Promise<string | null> {
  const bucket = overrideBucket || process.env.S3_BUCKET;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!bucket || !accessKey || !secretKey) {
    console.warn(`[media] presignS3Key: missing S3 config (bucket=${!!bucket}, key=${!!accessKey}, secret=${!!secretKey})`);
    return null;
  }

  try {
    const region = overrideRegion || process.env.S3_REGION || "eu-west-1";
    console.log(`[media] presignS3Key: bucket=${bucket}, region=${region}, key=${key.slice(0, 60)}`);
    const s3 = new S3Client({
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 3600 }
    );
    return url;
  } catch (err) {
    console.error(`[media] presignS3Key error for bucket=${bucket} region=${overrideRegion || process.env.S3_REGION} key=${key}:`, err);
    return null;
  }
}

async function resolveFileUrlForFal(
  fileUrl: string,
  mimeType?: string
): Promise<string> {
  const resolved = await resolveMediaUrl(fileUrl);
  if (resolved !== fileUrl) {
    console.log(`[fal] resolveFileUrlForFal: resolved via S3 presign`);
    return resolved;
  }

  // Last resort for local files: upload bytes directly to fal.ai storage
  if (fileUrl.startsWith("/uploads/") && process.env.FAL_KEY) {
    const filePath = path.join(process.cwd(), "public", fileUrl);
    if (fs.existsSync(filePath)) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = mimeType || "application/octet-stream";
        console.log(`[fal] Uploading local file to fal storage: ${filePath} (${fileBuffer.length} bytes)`);
        const falUrl = await uploadToFalStorage(fileBuffer, contentType, path.basename(fileUrl));
        console.log(`[fal] Uploaded to fal storage: ${falUrl.slice(0, 100)}`);
        return falUrl;
      } catch (err) {
        console.error("[fal] Failed to upload to fal.ai storage:", err);
      }
    } else {
      console.warn(`[fal] Local file not found: ${filePath}`);
    }
  }

  console.warn(`[fal] resolveFileUrlForFal: could not resolve, returning: ${resolved.slice(0, 120)}`);
  return resolved;
}

function ensureTmpDir(): string {
  const dir = "/tmp/nolink-uploads";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function persistBufferToS3(
  buffer: Buffer,
  ext: string,
  contentType: string
): Promise<string | null> {
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!bucket || !accessKey || !secretKey) return null;

  try {
    const region = process.env.S3_REGION || "eu-west-1";
    const key = `results/${uuidv4()}${ext}`;
    const s3 = new S3Client({
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (err) {
    console.error("Failed to persist buffer to S3:", err);
    return null;
  }
}

// ── Persist media results to S3 ─────────────────────────────────
// External URLs from providers like DALL-E, fal.ai etc. are temporary.
// This downloads the generated media and re-uploads it to our S3 bucket
// so the result can be served reliably from <img>/<video> elements.

const MEDIA_CONTENT_TYPE_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

const CONTENT_TYPE_EXT_MAP: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/ogg": ".ogg",
  "audio/flac": ".flac",
};

function guessExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(png|jpe?g|gif|webp|mp4|webm|mov|mp3|wav|m4a|ogg|flac)$/i);
    return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : "";
  } catch {
    return "";
  }
}

function isTemporaryMediaUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (isS3Url(url)) return false;
  if (url.startsWith("/uploads/")) return false;
  return true;
}

async function persistMediaToS3(
  mediaUrl: string,
  mediaType: "image" | "video" | "audio"
): Promise<string | null> {
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!bucket || !accessKey || !secretKey) return null;

  if (!isTemporaryMediaUrl(mediaUrl)) return null;

  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const responseContentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";

    let ext = CONTENT_TYPE_EXT_MAP[responseContentType] || guessExtFromUrl(mediaUrl);
    if (!ext) {
      const fallbackExt: Record<string, string> = { image: ".png", video: ".mp4", audio: ".mp3" };
      ext = fallbackExt[mediaType];
    }

    const contentType = responseContentType || MEDIA_CONTENT_TYPE_MAP[ext] || `${mediaType}/${ext.slice(1)}`;
    const region = process.env.S3_REGION || "eu-west-1";
    const key = `results/${uuidv4()}${ext}`;

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  } catch (err) {
    console.error("Failed to persist media to S3:", err);
    return null;
  }
}

const OPENAI_MODEL_MAP: Record<string, string> = {
  "gpt-5.2": "gpt-5.2",
  "gpt-5.2-pro": "gpt-5.2-pro",
  "gpt-5": "gpt-5",
  "gpt-5-mini": "gpt-5-mini",
  "gpt-5-nano": "gpt-5-nano",
  "gpt-4.1": "gpt-4.1",
  "gpt-4o": "gpt-4.1",
  "gpt-4o-mini": "gpt-5-nano",
  "llama-4": "gpt-5-nano",
};

function resolveOpenAIModel(modelId: string): string {
  return OPENAI_MODEL_MAP[modelId] || "gpt-5.2";
}

function isOpenAIModel(modelId: string): boolean {
  return modelId in OPENAI_MODEL_MAP;
}

// ── Provider-specific text generation ───────────────────────────

async function generateWithAnthropic(
  systemPrompt: string,
  userMessage: string,
  params: Record<string, unknown>,
  modelId: string,
  imageFiles: FileInput[] = []
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const claudeModel =
    modelId === "claude-4-opus"
      ? "claude-opus-4-20250514"
      : "claude-sonnet-4-20250514";

  const contentParts: any[] = [];

  for (const img of imageFiles) {
    const url = await resolveMediaUrl(img.url);
    contentParts.push({
      type: "image",
      source: { type: "url", url },
    });
  }

  contentParts.push({ type: "text", text: userMessage });

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
      messages: [{ role: "user", content: imageFiles.length > 0 ? contentParts : userMessage }],
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
  params: Record<string, unknown>,
  imageFiles: FileInput[] = []
): Promise<string | null> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;

  const parts: any[] = [];

  for (const img of imageFiles) {
    const base64 = fileToBase64(img.url);
    if (base64 && img.mimeType) {
      parts.push({
        inline_data: { mime_type: img.mimeType, data: base64 },
      });
    } else {
      const url = await resolveMediaUrl(img.url);
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const mime = img.mimeType || resp.headers.get("content-type") || "image/png";
          parts.push({
            inline_data: { mime_type: mime, data: buf.toString("base64") },
          });
        }
      } catch {}
    }
  }

  parts.push({ text: userMessage });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts }],
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
  imageFiles: FileInput[] = [],
  documentFiles: FileInput[] = []
): Promise<string> {
  const openai = getOpenAI();
  const apiModel = resolveOpenAIModel(modelId);

  const userContent: any[] = [];

  if (userMessage) {
    userContent.push({ type: "input_text", text: userMessage });
  }

  for (const img of imageFiles) {
    const url = await resolveMediaUrl(img.url);
    console.log(`[openai] Adding image input: ${url.slice(0, 120)}`);
    userContent.push({ type: "input_image", image_url: url });
  }

  for (const doc of documentFiles) {
    const url = await resolveMediaUrl(doc.url);
    console.log(`[openai] Adding file input: ${url.slice(0, 120)}`);
    userContent.push({
      type: "input_file",
      file_url: url,
    });
  }

  if (userContent.length === 0) {
    userContent.push({ type: "input_text", text: "Analyze the provided content." });
  }

  const input: any[] = [];

  if (systemPrompt) {
    input.push({
      role: "developer",
      content: [{ type: "input_text", text: systemPrompt }],
    });
  }

  input.push({ role: "user", content: userContent });

  console.log(`[openai] Calling Responses API – model: ${apiModel}, content parts: ${userContent.length}`);

  const response = await openai.responses.create({
    model: apiModel,
    input,
    ...(params.temperature != null ? { temperature: params.temperature as number } : {}),
  });

  const text = response.output_text || "";
  console.log(`[openai] Response received – ${text.length} chars`);
  return text;
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

  if (audioFile.url.startsWith("http") || isS3Url(audioFile.url) || extractMediaS3Key(audioFile.url)) {
    const resolved = await resolveMediaUrl(audioFile.url);
    const resp = await fetch(resolved);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const tmpPath = path.join(ensureTmpDir(), `whisper-tmp-${Date.now()}.mp3`);
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

  const buffer = Buffer.from(await response.arrayBuffer());
  const fileName = `tts-${Date.now()}.mp3`;

  const s3Url = await persistBufferToS3(buffer, ".mp3", "audio/mpeg");
  if (s3Url) {
    return { text: s3Url, files: [{ url: s3Url, type: "audio", name: fileName }] };
  }

  const dir = ensureTmpDir();
  const filePath = path.join(dir, fileName);
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

  const voiceId = (step.params?.voice_id as string) || "21m00Tcm4TlvDq8ikWAM";
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

  const buffer = Buffer.from(await response.arrayBuffer());
  const fileName = `elevenlabs-${Date.now()}.mp3`;

  const s3Url = await persistBufferToS3(buffer, ".mp3", "audio/mpeg");
  if (s3Url) {
    return { text: s3Url, files: [{ url: s3Url, type: "audio", name: fileName }] };
  }

  const dir = ensureTmpDir();
  const filePath = path.join(dir, fileName);
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

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    console.log(`[doc] Parsing PDF buffer (${buffer.length} bytes)`);
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    const text = data.text || "";
    console.log(`[doc] PDF parsed: ${data.numpages} pages, ${text.length} chars extracted`);
    if (!text) return "[PDF contained no extractable text]";
    return text;
  } catch (err) {
    console.error("[doc] PDF parse failed:", err);
    return `[PDF parse error: ${err instanceof Error ? err.message : "unknown"}]`;
  }
}

async function fetchDocumentText(fileUrl: string): Promise<string> {
  console.log(`[doc] fetchDocumentText called with: ${fileUrl}`);
  try {
    // Local files: read directly from disk (more reliable than HTTP self-fetch)
    if (fileUrl.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", fileUrl);
      if (!fs.existsSync(filePath)) {
        console.log(`[doc] Local file not found: ${filePath}`);
        return `[File not found: ${fileUrl}]`;
      }
      const buffer = fs.readFileSync(filePath);
      console.log(`[doc] Local file read: ${buffer.length} bytes`);
      const ext = path.extname(fileUrl).toLowerCase();
      if (ext === ".pdf") return parsePdfBuffer(buffer);
      return buffer.toString("utf-8");
    }

    // S3 / remote files: resolve to presigned URL if needed
    let fetchUrl = await resolveMediaUrl(fileUrl);
    console.log(`[doc] Resolved URL: ${fetchUrl.slice(0, 120)}...`);

    const resp = await fetch(fetchUrl);
    if (!resp.ok) {
      console.error(`[doc] Fetch failed: ${resp.status} ${resp.statusText} for ${fileUrl}`);
      return `[Could not fetch document: ${resp.status} ${resp.statusText}]`;
    }
    const contentType = resp.headers.get("content-type") || "";
    console.log(`[doc] Fetched OK, content-type: ${contentType}, size: ${resp.headers.get("content-length") || "unknown"}`);

    if (contentType.includes("pdf") || fileUrl.toLowerCase().endsWith(".pdf")) {
      const buffer = Buffer.from(await resp.arrayBuffer());
      return parsePdfBuffer(buffer);
    }

    if (
      contentType.includes("text") ||
      contentType.includes("json") ||
      contentType.includes("xml") ||
      contentType.includes("csv") ||
      contentType.includes("markdown")
    ) {
      return await resp.text();
    }

    // Fallback: try reading as text
    return await resp.text();
  } catch (err) {
    console.error(`[doc] fetchDocumentText error for ${fileUrl}:`, err);
    return `[Could not read document: ${fileUrl}] ${err instanceof Error ? err.message : ""}`;
  }
}

async function executeBasicStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  if (!step.aiModel) return input;

  const model = getModelById(step.aiModel);
  if (!model) return { text: `[Unknown model: ${step.aiModel}] ${input.text.slice(0, 200)}`, files: [] };

  const resolveInput = (text: string) =>
    text.replace(/\{\{input\}\}/g, input.text);

  const resolvedUserPrompt = step.prompt
    ? resolveInput(step.prompt)
    : input.text;

  const params = (step.params || {}) as Record<string, unknown>;

  // System prompt: prefer the model parameter "prompt" (labeled "System Prompt"
  // in the UI), fall back to the dedicated systemPrompt field.
  const rawSystemPrompt =
    (typeof params.prompt === "string" && params.prompt) ||
    step.systemPrompt ||
    "";
  const resolvedSystemPrompt = rawSystemPrompt
    ? resolveInput(rawSystemPrompt)
    : "";

  // ── Text models ──
  if (model.category === "text") {
    const imageFiles = getFilesByType(input.files, "image");
    const documentFiles = getFilesByType(input.files, "document");

    const systemMsg = resolvedSystemPrompt;

    let result: string | null = null;

    if (model.provider === "openai" || isOpenAIModel(step.aiModel)) {
      result = await generateTextWithOpenAI(
        systemMsg,
        resolvedUserPrompt,
        params,
        step.aiModel,
        imageFiles,
        documentFiles
      );
    } else if (model.provider === "anthropic") {
      const userMsg = resolvedUserPrompt + (await buildDocSuffix(documentFiles));
      result = await generateWithAnthropic(systemMsg, userMsg, params, step.aiModel, imageFiles);
    } else if (model.provider === "google") {
      const userMsg = resolvedUserPrompt + (await buildDocSuffix(documentFiles));
      result = await generateWithGemini(systemMsg, userMsg, params, imageFiles);
    } else if (model.provider === "xai") {
      const userMsg = resolvedUserPrompt + (await buildDocSuffix(documentFiles));
      result = await generateWithXai(systemMsg, userMsg, params);
    }

    if (result === null) {
      result = await generateTextWithOpenAI(
        systemMsg,
        resolvedUserPrompt,
        params,
        step.aiModel,
        imageFiles,
        documentFiles
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
        prompt: resolvedUserPrompt,
        n: 1,
        size: ((params.size as string) || "1024x1024") as any,
      });

      let url = response.data?.[0]?.url || "";
      if (!url && response.data?.[0]?.b64_json) {
        const imgBuffer = Buffer.from(response.data[0].b64_json, "base64");
        const s3Url = await persistBufferToS3(imgBuffer, ".png", "image/png");
        if (s3Url) {
          url = s3Url;
        } else {
          const dir = ensureTmpDir();
          const fileName = `gpt-img-${Date.now()}.png`;
          const filePath = path.join(dir, fileName);
          fs.writeFileSync(filePath, imgBuffer);
          url = `/uploads/${fileName}`;
        }
      }
      return { text: url, files: url ? [{ url, type: "image", name: "generated.png" }] : [] };
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: resolvedUserPrompt,
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

  const isCustom = step.aiModel === "fal-custom";
  const model = getModelById(step.aiModel);
  if (!isCustom && (!model || !model.isFal)) return { text: `[Unknown fal model: ${step.aiModel}]`, files: [] };

  let falEndpoint = isCustom ? step.customFalEndpoint : model?.falEndpoint;
  if (!falEndpoint) return { text: `[No fal.ai endpoint configured]`, files: [] };

  const resolvedParams: Record<string, unknown> = {};

  if (isCustom && step.customFalParams) {
    for (const { key, value } of step.customFalParams) {
      if (!key) continue;
      if (typeof value === "string" && value.includes("{{input}}")) {
        resolvedParams[key] = value.replace(/\{\{input\}\}/g, input.text);
      } else {
        resolvedParams[key] = value;
      }
    }
  } else if (step.params) {
    for (const [key, val] of Object.entries(step.params)) {
      if (Array.isArray(val)) {
        resolvedParams[key] = val.map((v) =>
          typeof v === "string" && v.includes("{{input}}")
            ? v.replace(/\{\{input\}\}/g, input.text)
            : v
        );
      } else if (typeof val === "string" && val.includes("{{input}}")) {
        resolvedParams[key] = val.replace(/\{\{input\}\}/g, input.text);
      } else {
        resolvedParams[key] = val;
      }
    }
  }

  if (!resolvedParams.prompt && step.prompt) {
    resolvedParams.prompt = step.prompt.replace(/\{\{input\}\}/g, input.text);
  }

  const modelParamKeys = new Set(model?.params?.map((p) => p.key) ?? []);
  const acceptsParam = (k: string) => isCustom || modelParamKeys.has(k);

  const imageFiles = getFilesByType(input.files, "image");
  const audioFiles = getFilesByType(input.files, "audio");
  const videoFiles = getFilesByType(input.files, "video");

  if (imageFiles.length > 0 && !resolvedParams.image_urls && acceptsParam("image_urls")) {
    const urls: string[] = [];
    for (const f of imageFiles) {
      console.log(`[fal] Resolving image file: ${f.url.slice(0, 120)} (type=${f.type}, mime=${f.mimeType})`);
      const resolved = await resolveFileUrlForFal(f.url, f.mimeType);
      console.log(`[fal] Resolved to: ${resolved.slice(0, 120)}`);
      urls.push(resolved);
    }
    resolvedParams.image_urls = urls;
  }
  if (imageFiles.length > 0 && !resolvedParams.image_url && acceptsParam("image_url")) {
    resolvedParams.image_url = await resolveFileUrlForFal(imageFiles[0].url, imageFiles[0].mimeType);
  }
  if (audioFiles.length > 0 && !resolvedParams.audio_url && acceptsParam("audio_url")) {
    resolvedParams.audio_url = await resolveFileUrlForFal(audioFiles[0].url, audioFiles[0].mimeType);
  }
  if (videoFiles.length > 0 && !resolvedParams.video_url && acceptsParam("video_url")) {
    resolvedParams.video_url = await resolveFileUrlForFal(videoFiles[0].url, videoFiles[0].mimeType);
  }

  const needsResolution = (v: string) =>
    isS3Url(v) || v.startsWith("/uploads/") || extractMediaS3Key(v) !== null;

  for (const [key, val] of Object.entries(resolvedParams)) {
    if (typeof val === "string" && needsResolution(val)) {
      resolvedParams[key] = await resolveFileUrlForFal(val);
    } else if (Array.isArray(val)) {
      resolvedParams[key] = await Promise.all(
        val.map((v) =>
          typeof v === "string" && needsResolution(v)
            ? resolveFileUrlForFal(v)
            : v
        )
      );
    }
  }

  if (!isCustom && model?.falEditEndpoint) {
    const hasImageUrl = resolvedParams.image_url && String(resolvedParams.image_url).length > 0;
    const hasImageUrls = Array.isArray(resolvedParams.image_urls) && resolvedParams.image_urls.length > 0;
    if (hasImageUrl || hasImageUrls) {
      falEndpoint = model.falEditEndpoint;
    }
  }

  if (process.env.FAL_KEY) {
    try {
      const logParams = { ...resolvedParams };
      for (const [k, v] of Object.entries(logParams)) {
        if (typeof v === "string" && v.length > 150) logParams[k] = v.slice(0, 150) + "...";
        if (Array.isArray(v)) logParams[k] = v.map((i) => typeof i === "string" && i.length > 150 ? i.slice(0, 150) + "..." : i);
      }
      console.log(`[fal] Calling ${falEndpoint} with params:`, JSON.stringify(logParams, null, 2));

      const response = await fetch(`https://fal.run/${falEndpoint}`, {
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

  const displayName = isCustom ? `Custom (${falEndpoint})` : model?.name || "Unknown";
  const category = model?.category;
  if (category === "image") {
    const url = `https://placehold.co/1024x1024/f59e0b/white?text=${encodeURIComponent(displayName)}`;
    return { text: url, files: [{ url, type: "image", name: "generated.png" }] };
  }
  if (category === "video" || isCustom) {
    return { text: `[${displayName} – no FAL_KEY configured]`, files: [] };
  }
  if (category === "audio") {
    return { text: `[${displayName} audio – no FAL_KEY configured]`, files: [] };
  }
  return { text: `[${displayName}] ${(resolvedParams.prompt as string || input.text).slice(0, 200)}`, files: [] };
}

// ── Replicate execution ─────────────────────────────────────────

function coerceReplicateValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "") return value;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

async function executeReplicateStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  if (!step.aiModel) return input;

  const isCustom = step.aiModel === "rep-custom";
  const model = getModelById(step.aiModel);
  if (!isCustom && (!model || !model.isReplicate)) return { text: `[Unknown Replicate model: ${step.aiModel}]`, files: [] };

  const rawReplicateModel = isCustom ? step.customReplicateModel : model?.replicateModel;
  if (!rawReplicateModel) return { text: `[No Replicate model configured]`, files: [] };

  let replicateModel: string;
  let replicateVersion: string | null = null;
  const colonIdx = rawReplicateModel.indexOf(":");
  if (colonIdx !== -1) {
    replicateModel = rawReplicateModel.slice(0, colonIdx);
    replicateVersion = rawReplicateModel.slice(colonIdx + 1) || null;
  } else {
    replicateModel = rawReplicateModel;
  }

  const resolvedParams: Record<string, unknown> = {};

  if (isCustom && step.customReplicateParams) {
    for (const { key, value } of step.customReplicateParams) {
      if (!key) continue;
      if (typeof value === "string" && value.includes("{{input}}")) {
        resolvedParams[key] = value.replace(/\{\{input\}\}/g, input.text);
      } else {
        resolvedParams[key] = coerceReplicateValue(value);
      }
    }
  } else if (step.params) {
    for (const [key, val] of Object.entries(step.params)) {
      if (Array.isArray(val)) {
        resolvedParams[key] = val.map((v) =>
          typeof v === "string" && v.includes("{{input}}")
            ? v.replace(/\{\{input\}\}/g, input.text)
            : typeof v === "string" ? coerceReplicateValue(v) : v
        );
      } else if (typeof val === "string" && val.includes("{{input}}")) {
        resolvedParams[key] = val.replace(/\{\{input\}\}/g, input.text);
      } else if (typeof val === "string") {
        resolvedParams[key] = coerceReplicateValue(val);
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

  const modelParamKeys = new Set(model?.params?.map((p) => p.key) ?? []);
  const acceptsParam = (k: string) => isCustom || modelParamKeys.has(k);

  if (imageFiles.length > 0 && !resolvedParams.image && acceptsParam("image")) {
    resolvedParams.image = imageFiles[0].url;
  }
  if (imageFiles.length > 0 && !resolvedParams.first_frame_image && acceptsParam("first_frame_image")) {
    resolvedParams.first_frame_image = imageFiles[0].url;
  }
  if (audioFiles.length > 0 && !resolvedParams.audio && acceptsParam("audio")) {
    resolvedParams.audio = audioFiles[0].url;
  }
  if (videoFiles.length > 0 && !resolvedParams.video && acceptsParam("video")) {
    resolvedParams.video = videoFiles[0].url;
  }

  if (process.env.REPLICATE_API_TOKEN) {
    try {
      const logParams = { ...resolvedParams };
      for (const [k, v] of Object.entries(logParams)) {
        if (typeof v === "string" && v.length > 150) logParams[k] = v.slice(0, 150) + "...";
        if (Array.isArray(v)) logParams[k] = v.map((i) => typeof i === "string" && i.length > 150 ? i.slice(0, 150) + "..." : i);
      }
      console.log(`[replicate] Calling ${replicateModel}${replicateVersion ? `:${replicateVersion}` : ""} with params:`, JSON.stringify(logParams, null, 2));

      const apiUrl = replicateVersion
        ? "https://api.replicate.com/v1/predictions"
        : `https://api.replicate.com/v1/models/${replicateModel}/predictions`;

      const requestBody = replicateVersion
        ? { version: replicateVersion, input: resolvedParams }
        : { input: resolvedParams };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.text();
        return { text: `[Replicate error: ${err.slice(0, 200)}]`, files: [] };
      }

      const result = await response.json();
      const output = result.output;

      if (typeof output === "string") {
        const lc = output.toLowerCase();
        if (lc.match(/\.(png|jpg|jpeg|webp|gif)($|\?)/)) {
          return { text: output, files: [{ url: output, type: "image", name: "generated.png" }] };
        }
        if (lc.match(/\.(mp4|webm|mov)($|\?)/)) {
          return { text: output, files: [{ url: output, type: "video", name: "generated.mp4" }] };
        }
        if (lc.match(/\.(mp3|wav|m4a|ogg|flac)($|\?)/)) {
          return { text: output, files: [{ url: output, type: "audio", name: "generated.mp3" }] };
        }
        return { text: output, files: [] };
      }
      if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        if (typeof first === "string") {
          const lc = first.toLowerCase();
          if (lc.match(/\.(png|jpg|jpeg|webp|gif)($|\?)/)) {
            return { text: first, files: output.map((u: string) => ({ url: u, type: "image", name: "generated.png" })) };
          }
          if (lc.match(/\.(mp4|webm|mov)($|\?)/)) {
            return { text: first, files: [{ url: first, type: "video", name: "generated.mp4" }] };
          }
          if (lc.match(/\.(mp3|wav|m4a|ogg|flac)($|\?)/)) {
            return { text: first, files: [{ url: first, type: "audio", name: "generated.mp3" }] };
          }
          return { text: first, files: [] };
        }
      }
      if (output && typeof output === "object") {
        return { text: JSON.stringify(output), files: [] };
      }

      return { text: JSON.stringify(result), files: [] };
    } catch (err) {
      return { text: `[Replicate error: ${err instanceof Error ? err.message : "Unknown"}]`, files: [] };
    }
  }

  const displayName = isCustom ? `Custom (${replicateModel})` : model?.name || "Unknown";
  const category = model?.category;
  if (category === "image") {
    const url = `https://placehold.co/1024x1024/6366f1/white?text=${encodeURIComponent(displayName)}`;
    return { text: url, files: [{ url, type: "image", name: "generated.png" }] };
  }
  if (category === "video" || isCustom) {
    return { text: `[${displayName} – no REPLICATE_API_TOKEN configured]`, files: [] };
  }
  if (category === "audio") {
    return { text: `[${displayName} audio – no REPLICATE_API_TOKEN configured]`, files: [] };
  }
  return { text: `[${displayName}] ${(resolvedParams.prompt as string || input.text).slice(0, 200)}`, files: [] };
}

// ── Custom API execution ────────────────────────────────────────

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
];

function sanitizeApiUrl(raw: string): string {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid API URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP(S) URLs are allowed");
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.includes(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("This host is not allowed for security reasons");
  }

  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) {
    throw new Error("Private IP ranges are not allowed");
  }

  return parsed.toString();
}

function sanitizeOutputUrl(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      const host = parsed.hostname.toLowerCase();
      if (BLOCKED_HOSTS.includes(host) || host.endsWith(".local") || host.endsWith(".internal")) return "";
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return "";
      return parsed.toString();
    }
  } catch { /* not a URL, return empty */ }
  return "";
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      current = (current as Record<string, unknown>)[arrMatch[1]];
      if (Array.isArray(current)) current = current[Number(arrMatch[2])];
      else return undefined;
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

async function executeCustomApiStep(
  step: StepDefinition,
  input: StepInput
): Promise<StepInput> {
  if (!step.customApiUrl) {
    return { text: "[Custom API: no URL configured]", files: [] };
  }

  let url: string;
  try {
    url = sanitizeApiUrl(step.customApiUrl);
  } catch (err) {
    return { text: `[Custom API error: ${err instanceof Error ? err.message : "Invalid URL"}]`, files: [] };
  }

  const method = (step.customApiMethod || "POST").toUpperCase();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (step.customApiHeaders) {
    for (const { key, value } of step.customApiHeaders) {
      if (key) headers[key] = value.replace(/\{\{input\}\}/g, input.text);
    }
  }

  const bodyParams: Record<string, string> = {};
  if (step.customApiParams) {
    for (const { key, value } of step.customApiParams) {
      if (!key) continue;
      bodyParams[key] = value.replace(/\{\{input\}\}/g, input.text);
    }
  }

  try {
    const fetchOptions: RequestInit = { method, headers };

    if (method === "GET" || method === "DELETE") {
      const u = new URL(url);
      for (const [k, v] of Object.entries(bodyParams)) {
        u.searchParams.set(k, v);
      }
      url = u.toString();
    } else {
      fetchOptions.body = JSON.stringify(bodyParams);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errText = await response.text();
      return { text: `[Custom API error ${response.status}: ${errText.slice(0, 300)}]`, files: [] };
    }

    const contentType = response.headers.get("content-type") || "";
    let result: unknown;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      return { text: text.slice(0, 10000), files: [] };
    }

    if (!step.customApiResultFields || step.customApiResultFields.length === 0) {
      return { text: JSON.stringify(result).slice(0, 10000), files: [] };
    }

    const outputs: string[] = [];
    const files: FileInput[] = [];

    for (const field of step.customApiResultFields) {
      const raw = getNestedValue(result, field.key);
      const strVal = raw != null ? String(raw) : "";

      switch (field.type) {
        case "image": {
          const safeUrl = sanitizeOutputUrl(strVal);
          if (safeUrl) {
            outputs.push(safeUrl);
            files.push({ url: safeUrl, type: "image", name: "api-image.png" });
          }
          break;
        }
        case "video": {
          const safeUrl = sanitizeOutputUrl(strVal);
          if (safeUrl) {
            outputs.push(safeUrl);
            files.push({ url: safeUrl, type: "video", name: "api-video.mp4" });
          }
          break;
        }
        case "audio": {
          const safeUrl = sanitizeOutputUrl(strVal);
          if (safeUrl) {
            outputs.push(safeUrl);
            files.push({ url: safeUrl, type: "audio", name: "api-audio.mp3" });
          }
          break;
        }
        case "document": {
          const safeUrl = sanitizeOutputUrl(strVal);
          if (safeUrl) {
            outputs.push(safeUrl);
            files.push({ url: safeUrl, type: "document", name: "api-doc" });
          }
          break;
        }
        case "url": {
          const safeUrl = sanitizeOutputUrl(strVal);
          if (safeUrl) outputs.push(safeUrl);
          break;
        }
        case "text":
        default:
          if (strVal) outputs.push(strVal.slice(0, 10000));
          break;
      }
    }

    return { text: outputs.join("\n"), files };
  } catch (err) {
    return { text: `[Custom API error: ${err instanceof Error ? err.message : "Unknown"}]`, files: [] };
  }
}

// ── Custom param resolution ─────────────────────────────────────

function resolveCustomParams(
  text: string,
  paramMap: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    if (name === "input") return match;
    return paramMap[name] !== undefined ? paramMap[name] : match;
  });
}

function applyCustomParamsToStep(
  step: StepDefinition,
  paramMap: Record<string, string>
): StepDefinition {
  if (Object.keys(paramMap).length === 0) return step;

  const resolvedPrompt = step.prompt
    ? resolveCustomParams(step.prompt, paramMap)
    : step.prompt;

  const resolvedSystemPrompt = step.systemPrompt
    ? resolveCustomParams(step.systemPrompt, paramMap)
    : step.systemPrompt;

  let resolvedParams = step.params;
  if (step.params) {
    resolvedParams = { ...step.params };
    for (const [key, val] of Object.entries(resolvedParams)) {
      if (typeof val === "string") {
        (resolvedParams as Record<string, unknown>)[key] = resolveCustomParams(val, paramMap);
      }
    }
  }

  let resolvedFalParams = step.customFalParams;
  if (step.customFalParams) {
    resolvedFalParams = step.customFalParams.map((p) => ({
      key: p.key,
      value: resolveCustomParams(p.value, paramMap),
    }));
  }

  let resolvedReplicateParams = step.customReplicateParams;
  if (step.customReplicateParams) {
    resolvedReplicateParams = step.customReplicateParams.map((p) => ({
      key: p.key,
      value: resolveCustomParams(p.value, paramMap),
    }));
  }

  let resolvedApiParams = step.customApiParams;
  if (step.customApiParams) {
    resolvedApiParams = step.customApiParams.map((p) => ({
      key: p.key,
      value: resolveCustomParams(p.value, paramMap),
    }));
  }

  let resolvedApiHeaders = step.customApiHeaders;
  if (step.customApiHeaders) {
    resolvedApiHeaders = step.customApiHeaders.map((p) => ({
      key: p.key,
      value: resolveCustomParams(p.value, paramMap),
    }));
  }

  let resolvedApiUrl = step.customApiUrl;
  if (step.customApiUrl) {
    resolvedApiUrl = resolveCustomParams(step.customApiUrl, paramMap);
  }

  return {
    ...step,
    prompt: resolvedPrompt,
    systemPrompt: resolvedSystemPrompt,
    params: resolvedParams,
    customFalParams: resolvedFalParams,
    customReplicateParams: resolvedReplicateParams,
    customApiParams: resolvedApiParams,
    customApiHeaders: resolvedApiHeaders,
    customApiUrl: resolvedApiUrl,
  };
}

// ── Utility step execution ──────────────────────────────────────

async function fetchMediaDuration(url: string): Promise<{ duration: number; format?: string; size?: number }> {
  try {
    const fullResp = await fetch(url);
    const contentType = fullResp.headers.get("content-type") || "";
    const contentLength = parseInt(fullResp.headers.get("content-length") || "0", 10);
    const buffer = Buffer.from(await fullResp.arrayBuffer());

    let duration = 0;
    let format = contentType.split("/")[1] || "unknown";

    try {
      const mm = await import("music-metadata");
      const metadata = await mm.parseBuffer(buffer, { mimeType: contentType || undefined });
      if (metadata.format.duration) {
        duration = Math.round(metadata.format.duration);
      }
      if (metadata.format.container) {
        format = metadata.format.container.toLowerCase();
      }
    } catch {
      // fallback: nothing
    }

    return { duration, format, size: contentLength || buffer.length };
  } catch {
    return { duration: 0 };
  }
}

function executeUtilityStep(
  step: StepDefinition,
  input: StepInput
): StepInput | Promise<StepInput> {
  const inputText = input.text || "";
  const cfg = step.utilityConfig;
  if (!cfg) return { text: inputText, files: input.files || [] };

  const op = cfg.operation;
  const resolve = (v: string) => v.replace(/\{\{input\}\}/g, inputText);

  switch (op) {
    case "uppercase":
      return { text: inputText.toUpperCase(), files: input.files || [] };
    case "lowercase":
      return { text: inputText.toLowerCase(), files: input.files || [] };
    case "trim":
      return { text: inputText.trim(), files: input.files || [] };
    case "reverse":
      return { text: inputText.split("").reverse().join(""), files: input.files || [] };
    case "length":
      return { text: String(inputText.length), files: input.files || [] };
    case "word_count":
      return { text: String(inputText.trim().split(/\s+/).filter(Boolean).length), files: input.files || [] };

    case "replace":
      return { text: inputText.replaceAll(cfg.operand || "", cfg.replacement || ""), files: input.files || [] };

    case "split": {
      const delim = cfg.operand === "\\n" ? "\n" : (cfg.operand || ",");
      const joinW = cfg.replacement === "\\n" ? "\n" : (cfg.replacement || "\n");
      return { text: inputText.split(delim).map((s) => s.trim()).filter(Boolean).join(joinW), files: input.files || [] };
    }
    case "join": {
      const delim2 = cfg.operand === "\\n" ? "\n" : (cfg.operand || "\n");
      const joinW2 = cfg.replacement || ", ";
      return { text: inputText.split(delim2).map((s) => s.trim()).filter(Boolean).join(joinW2), files: input.files || [] };
    }
    case "template":
      return { text: resolve(cfg.operand || "{{input}}"), files: input.files || [] };

    case "extract_json": {
      try {
        const parsed = JSON.parse(inputText);
        const path = (cfg.operand || "").split(".");
        let val: unknown = parsed;
        for (const key of path) {
          if (val && typeof val === "object" && key in (val as Record<string, unknown>)) {
            val = (val as Record<string, unknown>)[key];
          } else {
            val = undefined;
            break;
          }
        }
        const result = val !== undefined ? (typeof val === "string" ? val : JSON.stringify(val)) : "";
        return { text: result, files: input.files || [] };
      } catch {
        return { text: "Error: invalid JSON", files: input.files || [] };
      }
    }

    case "regex_extract": {
      try {
        const re = new RegExp(cfg.operand || "");
        const match = re.exec(inputText);
        return { text: match ? (match[1] || match[0]) : "", files: input.files || [] };
      } catch {
        return { text: "Error: invalid regex", files: input.files || [] };
      }
    }

    case "url_encode":
      return { text: encodeURIComponent(inputText), files: input.files || [] };
    case "url_decode":
      try {
        return { text: decodeURIComponent(inputText), files: input.files || [] };
      } catch {
        return { text: inputText, files: input.files || [] };
      }
    case "base64_encode":
      return { text: Buffer.from(inputText).toString("base64"), files: input.files || [] };
    case "base64_decode":
      try {
        return { text: Buffer.from(inputText, "base64").toString("utf-8"), files: input.files || [] };
      } catch {
        return { text: inputText, files: input.files || [] };
      }

    case "for_each": {
      const delimiter = cfg.delimiter === "\\n" ? "\n" : (cfg.delimiter || "\n");
      const items = inputText.split(delimiter).filter((s) => s.trim());
      const template = cfg.itemTemplate || "{{item}}";
      const joinWith = cfg.joinWith === "\\n" ? "\n" : (cfg.joinWith || "\n");
      const results = items.map((item, index) =>
        template
          .replace(/\{\{item\}\}/g, item.trim())
          .replace(/\{\{index\}\}/g, String(index))
          .replace(/\{\{index1\}\}/g, String(index + 1))
      );
      return { text: results.join(joinWith), files: input.files || [] };
    }

    case "math_add":
    case "math_subtract":
    case "math_multiply":
    case "math_divide":
    case "math_modulo": {
      const a = parseFloat(inputText);
      const b = parseFloat(resolve(cfg.operand || "0"));
      if (isNaN(a) || isNaN(b)) return { text: "NaN", files: input.files || [] };
      let result: number;
      switch (op) {
        case "math_add": result = a + b; break;
        case "math_subtract": result = a - b; break;
        case "math_multiply": result = a * b; break;
        case "math_divide": result = b === 0 ? NaN : a / b; break;
        case "math_modulo": result = b === 0 ? NaN : a % b; break;
        default: result = a;
      }
      return { text: String(result), files: input.files || [] };
    }

    case "math_round": {
      const n = parseFloat(inputText);
      if (isNaN(n)) return { text: "NaN", files: input.files || [] };
      const places = parseInt(resolve(cfg.operand || "0")) || 0;
      const factor = Math.pow(10, places);
      return { text: String(Math.round(n * factor) / factor), files: input.files || [] };
    }

    case "math_abs": {
      const n = parseFloat(inputText);
      return { text: isNaN(n) ? "NaN" : String(Math.abs(n)), files: input.files || [] };
    }

    case "math_min":
    case "math_max": {
      const nums = inputText.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
      if (nums.length === 0) return { text: "NaN", files: input.files || [] };
      return { text: String(op === "math_min" ? Math.min(...nums) : Math.max(...nums)), files: input.files || [] };
    }

    case "math_expression": {
      let expr = resolve(cfg.operand || inputText).replace(/\{\{input\}\}/g, inputText);
      expr = expr.replace(/[^0-9+\-*/%().eE\s]/g, "");
      try {
        const result = Function(`"use strict"; return (${expr})`)();
        return { text: String(result), files: input.files || [] };
      } catch {
        return { text: "Error: invalid expression", files: input.files || [] };
      }
    }

    case "audio_duration":
    case "video_duration":
      return (async () => {
        const url = inputText.trim();
        if (!url) return { text: "0", files: input.files || [] };
        const info = await fetchMediaDuration(url);
        return { text: String(info.duration), files: input.files || [] };
      })();

    case "media_info":
      return (async () => {
        const url = inputText.trim();
        if (!url) return { text: "{}", files: input.files || [] };
        const info = await fetchMediaDuration(url);
        return { text: JSON.stringify(info), files: input.files || [] };
      })();

    default:
      return { text: inputText, files: input.files || [] };
  }
}

// ── Logic gate condition evaluation (used by graph executor) ────

export function evaluateLogicCondition(
  step: StepDefinition,
  input: StepInput
): boolean {
  const cond = step.logicCondition;
  if (!cond) {
    console.log("[LogicGate] No condition found on step", step.id);
    return false;
  }

  const inputText = input.text || "";
  const resolve = (v: string) => v.replace(/\{\{input\}\}/g, inputText);
  const l = resolve(cond.leftOperand || "{{input}}");
  const r = resolve(cond.rightOperand || "");
  const op = cond.operator || "equals";

  let result: boolean;
  switch (op) {
    case "equals":
      result = l === r; break;
    case "not_equals":
      result = l !== r; break;
    case "contains":
      result = l.includes(r); break;
    case "not_contains":
      result = !l.includes(r); break;
    case "starts_with":
      result = l.startsWith(r); break;
    case "ends_with":
      result = l.endsWith(r); break;
    case "greater_than":
      result = parseFloat(l) > parseFloat(r); break;
    case "less_than":
      result = parseFloat(l) < parseFloat(r); break;
    case "is_empty":
      result = l.trim() === ""; break;
    case "is_not_empty":
      result = l.trim() !== ""; break;
    case "matches_regex":
      try {
        result = new RegExp(r).test(l);
      } catch {
        result = false;
      }
      break;
    default:
      result = false;
  }

  console.log(`[LogicGate] step=${step.id} | left=${JSON.stringify(l)} (raw=${JSON.stringify(cond.leftOperand)}) | op=${op} | right=${JSON.stringify(r)} (raw=${JSON.stringify(cond.rightOperand)}) | input=${JSON.stringify(inputText.slice(0, 100))} | result=${result}`);
  return result;
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
      case "REPLICATE":
        stepOutput = await executeReplicateStep(step, input);
        break;
      case "CUSTOM_API":
        stepOutput = await executeCustomApiStep(step, input);
        break;
      case "UTILITY":
        stepOutput = await Promise.resolve(executeUtilityStep(step, input));
        break;
      case "BASIC":
      default:
        stepOutput = await executeBasicStep(step, input);
        break;
    }
  } catch (error) {
    stepOutput = { text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`, files: [] };
  }

  // Persist image/video/audio results to S3 so they survive provider URL expiry
  const persistableTypes: Record<string, "image" | "video" | "audio"> = {
    IMAGE: "image",
    VIDEO: "video",
    AUDIO: "audio",
  };
  const mediaType = persistableTypes[step.outputType];
  const shouldPersist =
    mediaType &&
    stepOutput.text &&
    isTemporaryMediaUrl(stepOutput.text.trim());

  if (shouldPersist && mediaType) {
    const originalUrl = stepOutput.text.trim();
    const s3Url = await persistMediaToS3(originalUrl, mediaType);
    if (s3Url) {
      const extMap: Record<string, string> = { image: "png", video: "mp4", audio: "mp3" };
      stepOutput = {
        text: s3Url,
        files: stepOutput.files.length > 0
          ? stepOutput.files.map((f) => f.url === originalUrl ? { ...f, url: s3Url } : f)
          : [{ url: s3Url, type: mediaType, name: `generated.${extMap[mediaType]}` }],
      };
    }
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
  const customParamMap: Record<string, string> = {};

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (const step of sortedSteps) {
    if (step.customParams) {
      for (const cp of step.customParams) {
        if (cp.name) customParamMap[cp.name] = cp.value;
      }
    }

    const resolvedStep = applyCustomParamsToStep(step, customParamMap);
    const result = await executeStep(resolvedStep, currentInput);
    const { _nextInput, ...stepResult } = result;
    results.push(stepResult);
    currentInput = _nextInput;
  }

  return results;
}
