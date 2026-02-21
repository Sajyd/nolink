import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

export type StepNodeType = "inputNode" | "outputNode" | "basicNode" | "falAiNode";

export interface CustomParam {
  name: string;
  value: string;
}

export interface CustomFalParam {
  key: string;
  value: string;
}

export interface StepNodeData {
  label: string;
  stepType: StepNodeType;
  aiModel: string;
  inputType: string;
  outputType: string;
  prompt: string;
  order: number;
  acceptTypes?: string[];       // for input nodes: which media types to accept
  modelParams?: Record<string, unknown>; // model-specific parameter values
  paramBindings?: Record<string, string>; // param key → "input_1", "input_2", or "manual"
  customParams?: CustomParam[]; // user-defined params, referenceable as {{name}} in linked nodes
  customFalEndpoint?: string;   // user-entered fal.ai endpoint for custom model
  customFalParams?: CustomFalParam[]; // user-defined fal.ai API params (key/value, value can be {{variable}})
  [key: string]: unknown;
}

interface WorkflowStore {
  nodes: Node<StepNodeData>[];
  edges: Edge[];
  workflowName: string;
  workflowDescription: string;
  workflowCategory: string;
  workflowPrice: number;
  isPublic: boolean;
  selectedNodeId: string | null;
  exampleInput: string;
  exampleOutput: string;
  editingWorkflowId: string | null;

  setNodes: (nodes: Node<StepNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node<StepNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<StepNodeData>) => void;
  removeNode: (nodeId: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDescription: (desc: string) => void;
  setWorkflowCategory: (cat: string) => void;
  setWorkflowPrice: (price: number) => void;
  setIsPublic: (isPublic: boolean) => void;
  setExampleInput: (input: string) => void;
  setExampleOutput: (output: string) => void;
  setEditingWorkflowId: (id: string | null) => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  nodes: [],
  edges: [],
  workflowName: "",
  workflowDescription: "",
  workflowCategory: "OTHER",
  workflowPrice: 0,
  isPublic: true,
  selectedNodeId: null,
  exampleInput: "",
  exampleOutput: "",
  editingWorkflowId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNodeData: (nodeId, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),
  removeNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    })),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setWorkflowName: (name) => set({ workflowName: name }),
  setWorkflowDescription: (desc) => set({ workflowDescription: desc }),
  setWorkflowCategory: (cat) => set({ workflowCategory: cat }),
  setWorkflowPrice: (price) => set({ workflowPrice: price }),
  setIsPublic: (isPublic) => set({ isPublic }),
  setExampleInput: (input) => set({ exampleInput: input }),
  setExampleOutput: (output) => set({ exampleOutput: output }),
  setEditingWorkflowId: (id) => set({ editingWorkflowId: id }),
  reset: () =>
    set({
      nodes: [],
      edges: [],
      workflowName: "",
      workflowDescription: "",
      workflowCategory: "OTHER",
      workflowPrice: 0,
      isPublic: true,
      selectedNodeId: null,
      exampleInput: "",
      exampleOutput: "",
      editingWorkflowId: null,
    }),
}));
