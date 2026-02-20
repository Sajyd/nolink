import OpenAI from "openai";
import type { WorkflowStep } from "@prisma/client";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type StepOutput = { type: string; value: string | Record<string, unknown> };

export async function runStep(
  step: Pick<WorkflowStep, "aiModel" | "inputType" | "outputType" | "prompt">,
  input: string | Record<string, unknown>
): Promise<StepOutput> {
  const inputText = typeof input === "string" ? input : JSON.stringify(input);
  const isTextModel = step.aiModel.startsWith("gpt-") || step.aiModel.includes("claude") || step.aiModel.includes("llama");

  if (isTextModel && openai) {
    try {
      const model = step.aiModel.startsWith("gpt-4") ? "gpt-4o-mini" : "gpt-3.5-turbo";
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: step.prompt || "Process the user input and respond.",
          },
          { role: "user", content: inputText },
        ],
        max_tokens: 1024,
      });
      const text = completion.choices[0]?.message?.content ?? "";
      return { type: step.outputType, value: text };
    } catch (err) {
      console.error("OpenAI error:", err);
      return {
        type: step.outputType,
        value: `[Simulated output for ${step.aiModel}]: Processed input (${inputText.slice(0, 100)}...)`,
      };
    }
  }

  // Simulated output for image/audio/video/document or when no API key
  return {
    type: step.outputType,
    value: `[Simulated ${step.outputType} output from ${step.aiModel}] Input length: ${inputText.length} chars`,
  };
}

export async function runWorkflowSteps(
  steps: Array<Pick<WorkflowStep, "aiModel" | "inputType" | "outputType" | "prompt">>,
  initialInput: string
): Promise<StepOutput[]> {
  const outputs: StepOutput[] = [];
  let currentInput: string = initialInput;
  for (const step of steps) {
    const out = await runStep(step, currentInput);
    outputs.push(out);
    currentInput = typeof out.value === "string" ? out.value : JSON.stringify(out.value);
  }
  return outputs;
}
