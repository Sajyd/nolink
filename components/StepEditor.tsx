import type { WorkflowStepForm } from "@/types/workflow";
import type { IOType } from "@/lib/ai-models";
import {
  IO_TYPES,
  TEXT_MODELS,
  IMAGE_MODELS,
  AUDIO_MODELS,
  VIDEO_MODELS,
  DOCUMENT_MODELS,
} from "@/lib/ai-models";

const MODEL_MAP = {
  text: TEXT_MODELS,
  image: IMAGE_MODELS,
  audio: AUDIO_MODELS,
  video: VIDEO_MODELS,
  document: DOCUMENT_MODELS,
};

interface StepEditorProps {
  step: WorkflowStepForm;
  index: number;
  onChange: (step: WorkflowStepForm) => void;
  onRemove: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function StepEditor({
  step,
  index,
  onChange,
  onRemove,
  dragHandleProps,
}: StepEditorProps) {
  const inputModels = MODEL_MAP[step.inputType as IOType] || TEXT_MODELS;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="cursor-grab text-[var(--muted)] hover:text-[var(--fg)]"
          {...dragHandleProps}
        >
          ⋮⋮ Step {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-500 hover:underline"
        >
          Remove
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[var(--muted)]">Input type</label>
          <select
            value={step.inputType}
            onChange={(e) =>
              onChange({
                ...step,
                inputType: e.target.value as IOType,
                aiModel: (MODEL_MAP[e.target.value as IOType]?.[0]?.id ?? step.aiModel) as string,
              })
            }
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg)]"
          >
            {IO_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)]">Output type</label>
          <select
            value={step.outputType}
            onChange={(e) =>
              onChange({ ...step, outputType: e.target.value as IOType })
            }
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg)]"
          >
            {IO_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--muted)]">AI model</label>
          <select
            value={step.aiModel}
            onChange={(e) => onChange({ ...step, aiModel: e.target.value })}
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg)]"
          >
            {inputModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--muted)]">Prompt / template</label>
          <textarea
            value={step.prompt}
            onChange={(e) => onChange({ ...step, prompt: e.target.value })}
            rows={3}
            placeholder="e.g. Summarize the following text..."
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted)]"
          />
        </div>
      </div>
    </div>
  );
}
