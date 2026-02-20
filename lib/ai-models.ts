// Supported AI models per modality (MVP: we simulate or use OpenAI where available)
export const TEXT_MODELS = [
  { id: "gpt-4", name: "GPT-4", provider: "openai" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5", provider: "openai" },
  { id: "claude-3-sonnet", name: "Claude", provider: "anthropic" },
  { id: "llama-2", name: "LLaMA 2", provider: "meta" },
] as const;

export const IMAGE_MODELS = [
  { id: "dall-e-3", name: "DALL·E 3", provider: "openai" },
  { id: "stable-diffusion", name: "Stable Diffusion", provider: "stability" },
  { id: "midjourney", name: "MidJourney API", provider: "midjourney" },
] as const;

export const AUDIO_MODELS = [
  { id: "whisper-1", name: "OpenAI Whisper", provider: "openai" },
  { id: "elevenlabs-tts", name: "ElevenLabs TTS", provider: "elevenlabs" },
] as const;

export const VIDEO_MODELS = [
  { id: "runway-gen2", name: "Runway Gen-2", provider: "runway" },
  { id: "pika-labs", name: "Pika Labs API", provider: "pika" },
] as const;

export const DOCUMENT_MODELS = [
  { id: "gpt-4-pdf", name: "GPT-4 + PDF Parser", provider: "openai" },
  { id: "langchain-docs", name: "LangChain Document Loaders", provider: "langchain" },
] as const;

export const IO_TYPES = ["text", "image", "video", "audio", "document"] as const;
export type IOType = (typeof IO_TYPES)[number];

export function getModelsForInputType(inputType: IOType) {
  switch (inputType) {
    case "text":
      return [...TEXT_MODELS];
    case "image":
      return [...IMAGE_MODELS];
    case "audio":
      return [...AUDIO_MODELS];
    case "video":
      return [...VIDEO_MODELS];
    case "document":
      return [...DOCUMENT_MODELS];
    default:
      return [...TEXT_MODELS];
  }
}

export function getModelsForOutputType(outputType: IOType) {
  return getModelsForInputType(outputType);
}
