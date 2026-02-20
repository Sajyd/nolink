import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

export type StepNodeType = "inputNode" | "outputNode" | "basicNode" | "falAiNode";

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
    }),
}));
