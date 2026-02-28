import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type Node,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Undo2, Redo2 } from "lucide-react";
import BasicNode from "./StepNode";
import InputNode from "./InputNode";
import OutputNode from "./OutputNode";
import FalAiNode from "./FalAiNode";
import CustomApiNode from "./CustomApiNode";
import DeletableEdge from "./DeletableEdge";
import CanvasContextMenu, { type ContextMenuState } from "./CanvasContextMenu";
import { useWorkflowStore, type StepNodeData } from "@/lib/workflow-store";
import { playNodeClick, playConnect } from "@/lib/sounds";

function WorkflowCanvasInner() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const takeSnapshot = useWorkflowStore((s) => s.takeSnapshot);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const canUndo = useWorkflowStore((s) => s._past.length > 0);
  const canRedo = useWorkflowStore((s) => s._future.length > 0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      stepNode: BasicNode,
      basicNode: BasicNode,
      inputNode: InputNode,
      outputNode: OutputNode,
      falAiNode: FalAiNode,
      customApiNode: CustomApiNode,
    }),
    []
  );

  const edgeTypes: EdgeTypes = useMemo(
    () => ({ default: DeletableEdge }),
    []
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (changes.some((c) => c.type === "remove")) {
        takeSnapshot();
      }
      setNodes(applyNodeChanges(changes, nodes) as Node<StepNodeData>[]);
    },
    [nodes, setNodes, takeSnapshot]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (changes.some((c) => c.type === "remove")) {
        takeSnapshot();
      }
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges, takeSnapshot]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      takeSnapshot();
      setEdges(addEdge({ ...params, animated: true }, edges));
      playConnect();
    },
    [edges, setEdges, takeSnapshot]
  );

  const onNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      playNodeClick();
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, [setSelectedNodeId]);

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({
        kind: "pane",
        position: { x: event.clientX, y: event.clientY },
        flowPosition: flowPos,
      });
    },
    [screenToFlowPosition]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        kind: "node",
        position: { x: event.clientX, y: event.clientY },
        nodeId: node.id,
      });
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (isMod && e.key === "z" && e.shiftKey) ||
        (isMod && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const nodeColor = (node: Node) => {
    switch (node.type) {
      case "inputNode": return "#10b981";
      case "outputNode": return "#8b5cf6";
      case "falAiNode": return "#f59e0b";
      case "customApiNode": return "#f43f5e";
      default: return "#4c6ef5";
    }
  };

  return (
    <div ref={wrapperRef} className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-gray-50 dark:bg-gray-950"
        defaultEdgeOptions={{ animated: true }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !rounded-xl !shadow-lg" />
        <MiniMap
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !rounded-xl"
          nodeColor={nodeColor}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>

      {/* Undo / Redo toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-1.5 py-1 z-10">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <CanvasContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
