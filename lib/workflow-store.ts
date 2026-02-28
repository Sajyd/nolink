import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Node, Edge } from "@xyflow/react";

export type StepNodeType = "inputNode" | "outputNode" | "basicNode" | "falAiNode" | "customApiNode";

export interface CustomParam {
  name: string;
  value: string;
}

export interface CustomFalParam {
  key: string;
  value: string;
}

export type CustomApiResultType = "text" | "image" | "video" | "audio" | "document" | "url";

export interface CustomApiParam {
  key: string;
  value: string;
}

export interface CustomApiResultField {
  key: string;
  type: CustomApiResultType;
}

export type InputParameterType = "text" | "number" | "checkbox" | "select";

export interface InputParameter {
  id: string;
  name: string;
  label: string;
  type: InputParameterType;
  options?: string[];
  defaultValue: string;
  required: boolean;
}

export interface StepNodeData {
  label: string;
  stepType: StepNodeType;
  aiModel: string;
  inputType: string;
  outputType: string;
  prompt: string;
  order: number;
  acceptTypes?: string[];
  modelParams?: Record<string, unknown>;
  paramBindings?: Record<string, string>;
  fileBindings?: string[];
  customParams?: CustomParam[];
  customFalEndpoint?: string;
  customFalParams?: CustomFalParam[];
  customApiUrl?: string;
  customApiMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  customApiHeaders?: CustomApiParam[];
  customApiParams?: CustomApiParam[];
  customApiResultFields?: CustomApiResultField[];
  customApiPrice?: number;
  inputParameters?: InputParameter[];
  [key: string]: unknown;
}

interface CanvasSnapshot {
  nodes: Node<StepNodeData>[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

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

  _past: CanvasSnapshot[];
  _future: CanvasSnapshot[];

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
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  nodes: [] as Node<StepNodeData>[],
  edges: [] as Edge[],
  workflowName: "",
  workflowDescription: "",
  workflowCategory: "OTHER",
  workflowPrice: 0,
  isPublic: true,
  selectedNodeId: null as string | null,
  exampleInput: "",
  exampleOutput: "",
  editingWorkflowId: null as string | null,
  _past: [] as CanvasSnapshot[],
  _future: [] as CanvasSnapshot[],
};

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      takeSnapshot: () => {
        const { nodes, edges, _past } = get();
        set({
          _past: [..._past.slice(-(MAX_HISTORY - 1)), { nodes, edges }],
          _future: [],
        });
      },

      undo: () => {
        const { _past, _future, nodes, edges } = get();
        if (_past.length === 0) return;
        const previous = _past[_past.length - 1];
        set({
          _past: _past.slice(0, -1),
          _future: [{ nodes, edges }, ..._future],
          nodes: previous.nodes,
          edges: previous.edges,
        });
      },

      redo: () => {
        const { _past, _future, nodes, edges } = get();
        if (_future.length === 0) return;
        const next = _future[0];
        set({
          _past: [..._past, { nodes, edges }],
          _future: _future.slice(1),
          nodes: next.nodes,
          edges: next.edges,
        });
      },

      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      addNode: (node) => {
        const { nodes, edges, _past } = get();
        set({
          _past: [..._past.slice(-(MAX_HISTORY - 1)), { nodes, edges }],
          _future: [],
          nodes: [...nodes, node],
        });
      },
      updateNodeData: (nodeId, data) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          ),
        })),
      removeNode: (nodeId) => {
        const { nodes, edges, selectedNodeId, _past } = get();
        set({
          _past: [..._past.slice(-(MAX_HISTORY - 1)), { nodes, edges }],
          _future: [],
          nodes: nodes.filter((n) => n.id !== nodeId),
          edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: selectedNodeId === nodeId ? null : selectedNodeId,
        });
      },
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setWorkflowName: (name) => set({ workflowName: name }),
      setWorkflowDescription: (desc) => set({ workflowDescription: desc }),
      setWorkflowCategory: (cat) => set({ workflowCategory: cat }),
      setWorkflowPrice: (price) => set({ workflowPrice: price }),
      setIsPublic: (isPublic) => set({ isPublic }),
      setExampleInput: (input) => set({ exampleInput: input }),
      setExampleOutput: (output) => set({ exampleOutput: output }),
      setEditingWorkflowId: (id) => set({ editingWorkflowId: id }),
      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: "nolink-workflow-draft",
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        workflowName: state.workflowName,
        workflowDescription: state.workflowDescription,
        workflowCategory: state.workflowCategory,
        workflowPrice: state.workflowPrice,
        isPublic: state.isPublic,
        exampleInput: state.exampleInput,
        exampleOutput: state.exampleOutput,
        editingWorkflowId: state.editingWorkflowId,
      }),
    }
  )
);
