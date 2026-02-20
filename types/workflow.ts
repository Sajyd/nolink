import type { IOType } from "@/lib/ai-models";

export interface WorkflowStepForm {
  id: string;
  order: number;
  aiModel: string;
  inputType: IOType;
  outputType: IOType;
  prompt: string;
}

export interface WorkflowForm {
  name: string;
  description: string;
  category: string;
  priceInNolinks: number;
  isPublic: boolean;
  steps: WorkflowStepForm[];
}
