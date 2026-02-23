import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import {
  Zap,
  Play,
  Clock,
  User,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Type,
  Image as ImageIcon,
  Mic,
  Video,
  FileText,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
  File,
  Download,
  Copy,
  Check,
  ExternalLink,
  Lightbulb,
  Pencil,
  Sparkles,
  LogIn,
  Code2,
  Terminal,
} from "lucide-react";
import toast from "react-hot-toast";

interface Step {
  id: string;
  order: number;
  name: string;
  stepType: string;
  aiModel: string;
  inputType: string;
  outputType: string;
  prompt: string;
  acceptTypes: string[];
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  priceInNolinks: number;
  totalUses: number;
  slug: string;
  exampleInput: string | null;
  exampleOutput: string | null;
  creator: { id: string; name: string; image: string | null };
  steps: Step[];
}

interface LiveStep {
  stepId: string;
  stepName: string;
  stepType: string;
  outputType: string;
  aiModel: string | null;
  modelName: string | null;
  index: number;
  totalSteps: number;
  status: "pending" | "running" | "completed" | "error";
  output?: string;
  duration?: number;
  startedAt?: number;
}

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  preview?: string;
}

const IO_ICONS: Record<string, typeof Type> = {
  TEXT: Type,
  IMAGE: ImageIcon,
  AUDIO: Mic,
  VIDEO: Video,
  DOCUMENT: FileText,
};

const ACCEPT_MIME_MAP: Record<string, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/webm,video/quicktime",
  audio: "audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg",
  document:
    "application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const TYPE_ICONS: Record<string, typeof Type> = {
  image: ImageIcon,
  video: Video,
  audio: Mic,
  document: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  image: "Images",
  video: "Videos",
  audio: "Audio",
  document: "Documents",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WorkflowPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, update: updateSession } = useSession();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([]);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [showSteps, setShowSteps] = useState(true);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  const [isTrialRun, setIsTrialRun] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);

  const [showApiModal, setShowApiModal] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) fetchWorkflow();
  }, [id]);

  useEffect(() => {
    if (liveSteps.length > 0) {
      resultsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [liveSteps]);

  const fetchWorkflow = async () => {
    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setWorkflow(data);
    } catch {
      toast.error("Workflow not found");
    }
    setLoading(false);
  };

  const inputStep = workflow?.steps.find((s) => s.stepType === "INPUT");
  const acceptTypes = inputStep?.acceptTypes || [];
  const acceptsFiles = acceptTypes.some((t) => t !== "text");
  const acceptsText = acceptTypes.length === 0 || acceptTypes.includes("text");
  const fileAcceptTypes = acceptTypes.filter((t) => t !== "text");

  const acceptMimeString = fileAcceptTypes
    .map((t) => ACCEPT_MIME_MAP[t])
    .filter(Boolean)
    .join(",");

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      if (uploadedFiles.length + fileArray.length > 5) {
        toast.error("Maximum 5 files allowed");
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        fileArray.forEach((f) => formData.append("file", f));

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || "Upload failed");
          return;
        }

        const data = await res.json();
        const newFiles: UploadedFile[] = data.files.map(
          (f: UploadedFile, i: number) => ({
            ...f,
            preview:
              f.type === "image" ? URL.createObjectURL(fileArray[i]) : undefined,
          })
        );

        setUploadedFiles((prev) => [...prev, ...newFiles]);
        toast.success(
          `${newFiles.length} file${newFiles.length > 1 ? "s" : ""} uploaded`
        );
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [uploadedFiles.length]
  );

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const handleExecute = async () => {
    if (!input.trim() && uploadedFiles.length === 0) {
      toast.error("Please provide input");
      return;
    }

    setExecuting(true);
    setLiveSteps([]);
    setError("");
    setCreditsUsed(0);
    setFinished(false);
    setIsTrialRun(false);
    setTrialExpired(false);

    try {
      const res = await fetch(`/api/workflows/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: input.trim(),
          files: uploadedFiles.map((f) => ({
            url: f.url,
            type: f.type,
            name: f.name,
            mimeType: f.mimeType,
          })),
        }),
      });

      if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        if (data.error === "signup_required") {
          setTrialExpired(true);
          setExecuting(false);
          return;
        }
        if (res.status === 402) {
          setError(`Insufficient Nolinks. Required: ${data.required} NL`);
        } else {
          setError(data.error || "Execution failed");
        }
        setExecuting(false);
        return;
      }

      if (!res.ok) {
        setError("Execution failed");
        setExecuting(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Streaming not supported");
        setExecuting(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          let eventName = "";
          let eventData = "";

          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7);
            else if (line.startsWith("data: ")) eventData = line.slice(6);
          }

          if (!eventName || !eventData) continue;

          try {
            const data = JSON.parse(eventData);
            handleSSE(eventName, data);
          } catch {}
        }
      }
    } catch {
      setError("An error occurred during execution");
    } finally {
      setExecuting(false);
      setFinished(true);
      if (session) updateSession();
    }
  };

  const handleSSE = (event: string, data: any) => {
    switch (event) {
      case "workflow_start": {
        const pending: LiveStep[] = data.steps.map((s: any) => ({
          stepId: s.stepId,
          stepName: s.stepName,
          stepType: s.stepType,
          outputType: s.outputType,
          aiModel: s.aiModel,
          modelName: s.modelName,
          index: s.index,
          totalSteps: data.totalSteps,
          status: "pending" as const,
        }));
        setLiveSteps(pending);
        break;
      }
      case "step_start": {
        setLiveSteps((prev) =>
          prev.map((s) =>
            s.stepId === data.stepId
              ? { ...s, status: "running" as const, startedAt: Date.now() }
              : s
          )
        );
        break;
      }
      case "step_complete": {
        setLiveSteps((prev) =>
          prev.map((s) =>
            s.stepId === data.stepId
              ? {
                  ...s,
                  status: "completed" as const,
                  output: data.output,
                  duration: data.duration,
                  outputType: data.outputType,
                }
              : s
          )
        );
        break;
      }
      case "step_error": {
        setLiveSteps((prev) =>
          prev.map((s) =>
            s.stepId === data.stepId
              ? {
                  ...s,
                  status: "error" as const,
                  output: data.output,
                  duration: data.duration,
                }
              : s
          )
        );
        break;
      }
      case "workflow_complete": {
        setCreditsUsed(data.creditsUsed || 0);
        if (data.isTrialRun) setIsTrialRun(true);
        break;
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-500">
          Workflow not found
        </h2>
        <Link href="/marketplace" className="btn-primary mt-4 inline-flex">
          Browse Marketplace
        </Link>
      </div>
    );
  }

  const canExecute =
    !executing && (input.trim().length > 0 || uploadedFiles.length > 0);

  const completedCount = liveSteps.filter((s) => s.status === "completed").length;
  const totalCount = liveSteps.length;
  const hasErrors = liveSteps.some((s) => s.status === "error");
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <>
      <Head>
        <title>{workflow.name} — nolink.ai</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="badge-brand text-[11px]">
                {workflow.category.replace("_", " ")}
              </span>
              {workflow.priceInNolinks === 0 ? (
                <span className="badge-green">Free</span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-brand-600">
                  <Zap className="w-3.5 h-3.5" />
                  {workflow.priceInNolinks} NL per run
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold">{workflow.name}</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {workflow.description}
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {workflow.creator.name}
              </span>
              <span className="flex items-center gap-1">
                <Play className="w-3.5 h-3.5" />
                {workflow.totalUses} runs
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {workflow.steps.length} steps
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {session?.user?.id === workflow.creator.id && (
                <Link
                  href={`/edit-workflow/${workflow.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-brand-600 bg-gray-100 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit Workflow
                </Link>
              )}
              <button
                onClick={() => setShowApiModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-brand-600 bg-gray-100 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              >
                <Code2 className="w-3 h-3" />
                Use it in your app
              </button>
            </div>

            {acceptsFiles && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-gray-400">Accepts:</span>
                {fileAcceptTypes.map((t) => {
                  const Icon = TYPE_ICONS[t] || FileText;
                  return (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-[11px] font-medium"
                    >
                      <Icon className="w-3 h-3" />
                      {TYPE_LABELS[t] || t}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="mb-6">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Workflow Steps
            {showSteps ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showSteps && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {workflow.steps.map((step, i) => {
                const InputIcon = IO_ICONS[step.inputType] || Type;
                const OutputIcon = IO_ICONS[step.outputType] || Type;
                return (
                  <div
                    key={step.id}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <div className="card p-3 min-w-[160px]">
                      <p className="text-[10px] text-gray-400 font-medium">
                        Step {step.order}
                      </p>
                      <p className="text-sm font-medium mt-0.5 truncate">
                        {step.name}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {step.aiModel}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[10px]">
                        <span className="flex items-center gap-0.5 text-blue-500">
                          <InputIcon className="w-2.5 h-2.5" />
                          {step.inputType}
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className="flex items-center gap-0.5 text-purple-500">
                          <OutputIcon className="w-2.5 h-2.5" />
                          {step.outputType}
                        </span>
                      </div>
                    </div>
                    {i < workflow.steps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Examples */}
        {(workflow.exampleInput || workflow.exampleOutput) && (
          <div className="card p-6 mb-6 border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Lightbulb className="w-5 h-5" />
              Example
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {workflow.exampleInput && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Input</p>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-100 dark:border-amber-900/30">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
                      {workflow.exampleInput}
                    </pre>
                  </div>
                </div>
              )}
              {workflow.exampleOutput && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Output</p>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-100 dark:border-amber-900/30">
                    {isUrl(workflow.exampleOutput.trim()) ? (
                      looksLikeImage(workflow.exampleOutput.trim()) ? (
                        <img
                          src={workflow.exampleOutput.trim()}
                          alt="Example output"
                          className="rounded-lg max-h-48 object-contain"
                        />
                      ) : looksLikeVideo(workflow.exampleOutput.trim()) ? (
                        <video
                          src={workflow.exampleOutput.trim()}
                          controls
                          className="rounded-lg max-h-48 w-full"
                        />
                      ) : looksLikeAudio(workflow.exampleOutput.trim()) ? (
                        <audio src={workflow.exampleOutput.trim()} controls className="w-full" />
                      ) : (
                        <a
                          href={workflow.exampleOutput.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-brand-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View example output
                        </a>
                      )
                    ) : (
                      <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
                        {workflow.exampleOutput}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom API Disclaimer */}
        {workflow.steps.some((s) => s.stepType === "CUSTOM_API") && (
          <div className="flex items-start gap-2.5 px-4 py-3 mb-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Third-party API disclaimer
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed mt-0.5">
                This workflow connects to one or more external APIs that are not
                verified or endorsed by Nolink. Your data may be processed by
                third-party services. Do not submit sensitive or personal information
                unless you trust the workflow creator and the APIs used.
              </p>
            </div>
          </div>
        )}

        {/* Run Workflow */}
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-3">Run this workflow</h2>

          {/* File Upload Zone */}
          {acceptsFiles && (
            <div className="mb-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={acceptMimeString}
                  onChange={(e) => {
                    if (e.target.files) uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                  disabled={executing || uploading}
                />

                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    <p className="text-sm text-gray-500">Uploading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Drop files here or click to browse
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Accepts{" "}
                        {fileAcceptTypes
                          .map((t) => TYPE_LABELS[t] || t)
                          .join(", ")}{" "}
                        — max 50MB per file, up to 5 files
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                    >
                      {file.type === "image" && file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            file.type === "video"
                              ? "bg-purple-50 dark:bg-purple-900/20"
                              : file.type === "audio"
                                ? "bg-amber-50 dark:bg-amber-900/20"
                                : "bg-blue-50 dark:bg-blue-900/20"
                          }`}
                        >
                          {file.type === "video" && <Video className="w-5 h-5 text-purple-500" />}
                          {file.type === "audio" && <Mic className="w-5 h-5 text-amber-500" />}
                          {file.type === "document" && <FileText className="w-5 h-5 text-blue-500" />}
                          {!["video", "audio", "document"].includes(file.type) && (
                            <File className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">
                          {file.type} — {formatFileSize(file.size)}
                        </p>
                      </div>

                      <button
                        onClick={() => removeFile(i)}
                        disabled={executing}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Text Input */}
          {(acceptsText || !acceptsFiles) && (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              className="input-field font-mono text-sm"
              placeholder={
                acceptsFiles
                  ? "Optionally enter a text prompt alongside your files..."
                  : "Enter your input here..."
              }
              disabled={executing}
            />
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">
              {!session
                ? "Try it free — no account needed"
                : workflow.priceInNolinks > 0
                  ? `This will cost ${workflow.priceInNolinks} Nolinks`
                  : "This workflow is free to run"}
            </p>
            <button
              onClick={handleExecute}
              disabled={!canExecute}
              className="btn-primary gap-2"
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : !session ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Try it Free
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Workflow
                </>
              )}
            </button>
          </div>
        </div>

        {/* Trial expired — signup CTA */}
        {trialExpired && (
          <div className="card p-6 mb-6 border-brand-200 dark:border-brand-800 bg-gradient-to-br from-brand-50 to-purple-50 dark:from-brand-950/40 dark:to-purple-950/30">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  You've used your free run
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-md">
                  Create a free account to keep running workflows. You'll get <strong>50 free Nolinks</strong> to start — no credit card required.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/signup"
                  className="btn-primary gap-2 px-6"
                >
                  <LogIn className="w-4 h-4" />
                  Sign Up Free
                </Link>
                <Link
                  href="/auth/signin"
                  className="text-sm text-gray-500 hover:text-brand-600 transition-colors"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card p-4 mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Live Results */}
        {liveSteps.length > 0 && (
          <div className="space-y-4">
            {/* Header + Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  {executing ? (
                    <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                  ) : hasErrors ? (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  {executing
                    ? `Running — Step ${Math.min(completedCount + 1, totalCount)} of ${totalCount}`
                    : "Results"}
                </h2>
                {creditsUsed > 0 && !executing && (
                  <span className="text-sm text-gray-500">
                    Used: {creditsUsed} NL
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    hasErrors
                      ? "bg-red-500"
                      : finished
                        ? "bg-emerald-500"
                        : "bg-brand-500"
                  }`}
                  style={{ width: `${executing && progressPct === 0 ? 2 : progressPct}%` }}
                />
              </div>
            </div>

            {/* Step cards */}
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {liveSteps.map((step) => (
                <LiveStepCard key={step.stepId} step={step} />
              ))}
              <div ref={resultsEndRef} />
            </div>

            {/* Post-trial signup nudge */}
            {isTrialRun && finished && !executing && (
              <div className="mt-6 card p-5 border-brand-200 dark:border-brand-800 bg-gradient-to-r from-brand-50/80 to-purple-50/80 dark:from-brand-950/30 dark:to-purple-950/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Liked the result? There's more where that came from.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Sign up for free and get 50 Nolinks to run any workflow.
                    </p>
                  </div>
                  <Link href="/auth/signup" className="btn-primary text-sm gap-1.5 shrink-0">
                    <LogIn className="w-3.5 h-3.5" />
                    Sign Up Free
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showApiModal && (
        <ApiIntegrationModal
          workflow={workflow}
          onClose={() => setShowApiModal(false)}
        />
      )}
    </>
  );
}

// ── API Integration Modal ───────────────────────────────────────

function ApiIntegrationModal({
  workflow,
  onClose,
}: {
  workflow: Workflow;
  onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"curl" | "javascript" | "python">("curl");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://nolink.ai";
  const apiUrl = `${baseUrl}/api/workflows/${workflow.id}/execute`;

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const inputStep = workflow.steps.find((s) => s.stepType === "INPUT");
  const acceptsFiles = inputStep?.acceptTypes?.some((t) => t !== "text");

  const curlSnippet = `curl -X POST "${apiUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \\
  -d '{
    "input": "Your text input here"${acceptsFiles ? `,
    "files": [
      {
        "url": "https://example.com/file.png",
        "type": "image",
        "name": "file.png",
        "mimeType": "image/png"
      }
    ]` : ""}
  }'`;

  const jsSnippet = `const response = await fetch("${apiUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // Include session cookie or use credentials
  },
  credentials: "include",
  body: JSON.stringify({
    input: "Your text input here",${acceptsFiles ? `
    files: [
      {
        url: "https://example.com/file.png",
        type: "image",
        name: "file.png",
        mimeType: "image/png",
      },
    ],` : ""}
  }),
});

// The response is a Server-Sent Events (SSE) stream
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\\n\\n");
  buffer = parts.pop() || "";

  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "", data = "";
    for (const line of part.split("\\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event && data) {
      const parsed = JSON.parse(data);
      switch (event) {
        case "workflow_start":
          console.log("Workflow started:", parsed.totalSteps, "steps");
          break;
        case "step_start":
          console.log(\`Step \${parsed.index} started: \${parsed.stepName}\`);
          break;
        case "step_complete":
          console.log(\`Step \${parsed.index} done:\`, parsed.output);
          break;
        case "step_error":
          console.error(\`Step \${parsed.index} failed:\`, parsed.output);
          break;
        case "workflow_complete":
          console.log("Workflow finished. Credits used:", parsed.creditsUsed);
          break;
      }
    }
  }
}`;

  const pythonSnippet = `import requests
import json

url = "${apiUrl}"
headers = {
    "Content-Type": "application/json",
    "Cookie": "next-auth.session-token=YOUR_SESSION_TOKEN"
}
payload = {
    "input": "Your text input here",${acceptsFiles ? `
    "files": [
        {
            "url": "https://example.com/file.png",
            "type": "image",
            "name": "file.png",
            "mimeType": "image/png"
        }
    ]` : ""}
}

# The response is a Server-Sent Events (SSE) stream
response = requests.post(url, json=payload, headers=headers, stream=True)

for line in response.iter_lines(decode_unicode=True):
    if not line:
        continue
    if line.startswith("event: "):
        event = line[7:]
    elif line.startswith("data: "):
        data = json.loads(line[6:])
        if event == "step_complete":
            print(f"Step {data['index']} done: {data['output'][:100]}")
        elif event == "workflow_complete":
            print(f"Workflow finished. Credits used: {data['creditsUsed']}")
        elif event == "step_error":
            print(f"Step {data['index']} failed: {data['output']}")`;

  const snippets = { curl: curlSnippet, javascript: jsSnippet, python: pythonSnippet };
  const tabLabels = { curl: "cURL", javascript: "JavaScript", python: "Python" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
              <Code2 className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Use it in your app
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Integrate <span className="font-medium">{workflow.name}</span> via the Nolink API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* API Endpoint */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              API Endpoint
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-sm overflow-x-auto">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                  POST
                </span>
                <span className="text-gray-700 dark:text-gray-300 truncate">
                  {apiUrl}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(apiUrl, "url")}
                className="shrink-0 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title="Copy URL"
              >
                {copiedId === "url" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Auth</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                Session cookie
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Response</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                SSE stream
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cost</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                {workflow.priceInNolinks === 0 ? "Free" : `${workflow.priceInNolinks} NL / run`}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Steps</p>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                {workflow.steps.length} steps
              </p>
            </div>
          </div>

          {/* SSE Events */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              SSE Events
            </label>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 p-3 space-y-1.5">
              {[
                { event: "workflow_start", desc: "Workflow initialized with step list" },
                { event: "step_start", desc: "A step begins processing" },
                { event: "step_complete", desc: "A step finished — output in data.output" },
                { event: "step_error", desc: "A step failed — error in data.output" },
                { event: "workflow_complete", desc: "All done — creditsUsed in data" },
              ].map((e) => (
                <div key={e.event} className="flex items-start gap-2">
                  <code className="shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">
                    {e.event}
                  </code>
                  <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {e.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Code snippets */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Code Example
            </label>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 mb-3">
              {(Object.keys(tabLabels) as Array<keyof typeof tabLabels>).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>

            {/* Code block */}
            <div className="relative group">
              <pre className="rounded-xl bg-gray-900 dark:bg-gray-950 border border-gray-800 p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-gray-300 max-h-80 overflow-y-auto">
                <code>{snippets[activeTab]}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(snippets[activeTab], "code")}
                className="absolute top-3 right-3 p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100"
                title="Copy code"
              >
                {copiedId === "code" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-brand-50/50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800/40">
            <Terminal className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Authenticate by including your session cookie. The response streams as{" "}
              <strong>Server-Sent Events</strong> — parse each event to track step progress
              and collect the final output.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live step card ──────────────────────────────────────────────

function LiveStepCard({ step }: { step: LiveStep }) {
  if (step.status === "pending") {
    return (
      <div className="card p-4 opacity-40">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
          <span className="text-sm text-gray-400">
            Step {step.index}: {step.stepName}
          </span>
          {step.modelName && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
              {step.modelName}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (step.status === "running") {
    return (
      <div className="card p-4 border-brand-200 dark:border-brand-800/50 bg-brand-50/30 dark:bg-brand-900/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2 text-brand-700 dark:text-brand-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            Step {step.index}: {step.stepName}
          </h3>
          {step.modelName && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-medium">
              {step.modelName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-1 rounded-full bg-brand-100 dark:bg-brand-900/30 overflow-hidden">
              <div className="h-full rounded-full bg-brand-500 animate-progress" />
            </div>
          </div>
          <ElapsedTimer startedAt={step.startedAt!} />
        </div>

        <p className="text-xs text-brand-600/70 dark:text-brand-400/70 mt-2">
          Processing with {step.modelName || step.aiModel || "AI"}...
        </p>
      </div>
    );
  }

  const hasError = step.status === "error" || isStepError(step);

  return (
    <div
      className={`card p-4 ${
        hasError ? "border-red-200 dark:border-red-800/60" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          {hasError ? (
            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          )}
          <span
            className={
              hasError
                ? "text-red-600 dark:text-red-400"
                : "text-gray-600 dark:text-gray-300"
            }
          >
            Step {step.index}: {step.stepName}
          </span>
          {hasError && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
              Error
            </span>
          )}
        </h3>
        <span className="text-[10px] text-gray-400 shrink-0 ml-2">
          {step.duration != null ? `${step.duration}ms` : ""}
        </span>
      </div>

      {step.output && (
        <ResultDisplay
          output={step.output}
          outputType={step.outputType}
          stepName={step.stepName}
          hasError={hasError}
        />
      )}
    </div>
  );
}

// ── Elapsed timer ───────────────────────────────────────────────

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-xs font-mono text-brand-600 dark:text-brand-400 tabular-nums shrink-0">
      {mins > 0 ? `${mins}m ` : ""}
      {secs}s
    </span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

function isStepError(step: { output?: string; status: string }): boolean {
  if (step.status === "error") return true;
  const o = step.output || "";
  return (
    o.startsWith("Error:") ||
    /^\[.*error.*\]/i.test(o) ||
    o.startsWith("[fal.ai error") ||
    o.startsWith("[ElevenLabs error") ||
    o.startsWith("[Unknown model") ||
    o.startsWith("[Unknown fal model") ||
    o.startsWith("Could not access") ||
    o.startsWith("No audio file") ||
    o.startsWith("No text provided")
  );
}

function isUrl(str: string): boolean {
  return (
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("/uploads/")
  );
}

function looksLikeImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

function looksLikeVideo(url: string): boolean {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
}

function looksLikeAudio(url: string): boolean {
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url);
}

// ── Result display ──────────────────────────────────────────────

function ResultDisplay({
  output,
  outputType,
  stepName,
  hasError,
}: {
  output: string;
  outputType: string;
  stepName: string;
  hasError: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const outputIsUrl = isUrl(output.trim());
  const trimmedOutput = output.trim();

  if (hasError) {
    return (
      <div className="rounded-lg p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <pre className="text-sm whitespace-pre-wrap font-mono text-red-600 dark:text-red-400 max-h-40 overflow-y-auto flex-1">
            {output}
          </pre>
        </div>
      </div>
    );
  }

  if (
    (outputType === "IMAGE" || looksLikeImage(trimmedOutput)) &&
    outputIsUrl
  ) {
    return (
      <div className="space-y-2">
        <img
          src={trimmedOutput}
          alt={stepName}
          className="rounded-lg max-h-[28rem] object-contain bg-gray-50 dark:bg-gray-800"
        />
        <div className="flex items-center gap-2">
          <a
            href={trimmedOutput}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open full size
          </a>
          <a
            href={trimmedOutput}
            download
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download
          </a>
        </div>
      </div>
    );
  }

  if (
    (outputType === "VIDEO" || looksLikeVideo(trimmedOutput)) &&
    outputIsUrl
  ) {
    return (
      <div className="space-y-2">
        <video
          src={trimmedOutput}
          controls
          className="rounded-lg max-h-[28rem] w-full bg-black"
        >
          Your browser does not support the video element.
        </video>
        <a
          href={trimmedOutput}
          download
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition-colors"
        >
          <Download className="w-3 h-3" />
          Download video
        </a>
      </div>
    );
  }

  if (
    (outputType === "AUDIO" || looksLikeAudio(trimmedOutput)) &&
    outputIsUrl
  ) {
    return (
      <div className="space-y-2">
        <audio src={trimmedOutput} controls className="w-full">
          Your browser does not support the audio element.
        </audio>
        <a
          href={trimmedOutput}
          download
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition-colors"
        >
          <Download className="w-3 h-3" />
          Download audio
        </a>
      </div>
    );
  }

  if (outputType === "DOCUMENT" && outputIsUrl) {
    return (
      <a
        href={trimmedOutput}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-100 dark:border-blue-800/40"
      >
        <FileText className="w-4 h-4" />
        Download Document
        <Download className="w-3.5 h-3.5 ml-1 opacity-60" />
      </a>
    );
  }

  if (outputIsUrl) {
    return (
      <a
        href={trimmedOutput}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-sm font-medium hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors border border-brand-100 dark:border-brand-800/40"
      >
        <ExternalLink className="w-4 h-4" />
        Open Link
      </a>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative group">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-80 overflow-y-auto">
        <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 dark:text-gray-300 leading-relaxed">
          {output}
        </pre>
      </div>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
