import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type Node,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import BasicNode from "./StepNode";
import InputNode from "./InputNode";
import OutputNode from "./OutputNode";
import FalAiNode from "./FalAiNode";
import CustomApiNode from "./CustomApiNode";
import DeletableEdge from "./DeletableEdge";
import { useWorkflowStore, type StepNodeData } from "@/lib/workflow-store";
import { playNodeClick, playConnect } from "@/lib/sounds";

export default function WorkflowCanvas() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);

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
      setNodes(applyNodeChanges(changes, nodes) as Node<StepNodeData>[]);
    },
    [nodes, setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges(addEdge({ ...params, animated: true }, edges));
      playConnect();
    },
    [edges, setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      playNodeClick();
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

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
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
    </div>
  );
}
