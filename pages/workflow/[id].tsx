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
    if (!session) {
      router.push("/auth/signin");
      return;
    }
    if (!input.trim() && uploadedFiles.length === 0) {
      toast.error("Please provide input");
      return;
    }

    setExecuting(true);
    setLiveSteps([]);
    setError("");
    setCreditsUsed(0);
    setFinished(false);

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
      updateSession();
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
              {workflow.priceInNolinks > 0
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
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Workflow
                </>
              )}
            </button>
          </div>
        </div>

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
          </div>
        )}
      </div>
    </>
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
