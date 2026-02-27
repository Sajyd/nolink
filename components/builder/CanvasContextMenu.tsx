import { useCallback, useEffect, useRef } from "react";
import {
  Upload,
  Download,
  Cpu,
  Sparkles,
  Globe,
  Copy,
  Trash2,
  Maximize,
  Minimize,
  MousePointer2,
  LocateFixed,
  Clipboard,
  ChevronRight,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { v4 as uuid } from "uuid";
import { useWorkflowStore, type StepNodeData, type StepNodeType } from "@/lib/workflow-store";
import { playAddNode, playRemoveNode } from "@/lib/sounds";
import type { Node } from "@xyflow/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MenuPosition {
  x: number;
  y: number;
}

interface PaneMenuState {
  kind: "pane";
  position: MenuPosition;
  flowPosition: { x: number; y: number };
}

interface NodeMenuState {
  kind: "node";
  position: MenuPosition;
  nodeId: string;
}

export type ContextMenuState = PaneMenuState | NodeMenuState | null;

interface CanvasContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/* ------------------------------------------------------------------ */
/*  Node templates (mirrored from BuilderToolbar)                      */
/* ------------------------------------------------------------------ */

const NODE_TEMPLATES: {
  type: StepNodeType;
  rfType: string;
  label: string;
  icon: typeof Cpu;
  iconColor: string;
  defaults: Partial<StepNodeData>;
}[] = [
  {
    type: "inputNode",
    rfType: "inputNode",
    label: "User Input",
    icon: Upload,
    iconColor: "text-emerald-500",
    defaults: {
      label: "User Input",
      stepType: "inputNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
      acceptTypes: ["text"],
    },
  },
  {
    type: "basicNode",
    rfType: "basicNode",
    label: "Basic AI Node",
    icon: Cpu,
    iconColor: "text-blue-500",
    defaults: {
      label: "",
      stepType: "basicNode",
      aiModel: "gpt-4o",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "Process the following input: {{input}}",
    },
  },
  {
    type: "falAiNode",
    rfType: "falAiNode",
    label: "fal.ai Node",
    icon: Sparkles,
    iconColor: "text-amber-500",
    defaults: {
      label: "",
      stepType: "falAiNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "IMAGE",
      prompt: "",
      modelParams: {},
      paramBindings: {},
    },
  },
  {
    type: "customApiNode",
    rfType: "customApiNode",
    label: "Custom API",
    icon: Globe,
    iconColor: "text-rose-500",
    defaults: {
      label: "",
      stepType: "customApiNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
      customApiUrl: "",
      customApiMethod: "POST",
      customApiHeaders: [],
      customApiParams: [],
      customApiResultFields: [],
      customApiPrice: 0,
    },
  },
  {
    type: "outputNode",
    rfType: "outputNode",
    label: "Final Output",
    icon: Download,
    iconColor: "text-violet-500",
    defaults: {
      label: "Final Output",
      stepType: "outputNode",
      aiModel: "",
      inputType: "TEXT",
      outputType: "TEXT",
      prompt: "",
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Separator() {
  return <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />;
}

function MenuItem({
  icon: Icon,
  iconColor,
  label,
  shortcut,
  danger,
  onClick,
}: {
  icon: typeof Cpu;
  iconColor?: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] rounded-lg transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60"
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${iconColor ?? (danger ? "text-red-400" : "text-gray-400 dark:text-gray-500")}`} />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <kbd className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{shortcut}</kbd>
      )}
    </button>
  );
}

function SubMenu({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Cpu;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group/sub">
      <div className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-default">
        <Icon className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="invisible group-hover/sub:visible absolute left-full top-0 ml-1 min-w-[180px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1.5 z-[100]">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function CanvasContextMenu({
  menu,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const store = useWorkflowStore();
  const { fitView, setCenter, getNode } = useReactFlow();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const addNodeAtPosition = useCallback(
    (templateIdx: number) => {
      if (menu?.kind !== "pane") return;
      const template = NODE_TEMPLATES[templateIdx];
      const order = store.nodes.length + 1;

      const newNode: Node<StepNodeData> = {
        id: uuid(),
        type: template.rfType,
        position: menu.flowPosition,
        data: {
          ...template.defaults,
          label: template.defaults.label || `Step ${order}`,
          order,
        } as StepNodeData,
      };

      store.addNode(newNode);
      playAddNode();
      store.setSelectedNodeId(newNode.id);
      onClose();
    },
    [menu, store, onClose]
  );

  const duplicateNode = useCallback(() => {
    if (menu?.kind !== "node") return;
    const original = store.nodes.find((n) => n.id === menu.nodeId);
    if (!original) return;

    const order = store.nodes.length + 1;
    const newNode: Node<StepNodeData> = {
      id: uuid(),
      type: original.type,
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      data: {
        ...JSON.parse(JSON.stringify(original.data)),
        label: `${original.data.label} (copy)`,
        order,
      },
    };

    store.addNode(newNode);
    playAddNode();
    store.setSelectedNodeId(newNode.id);
    onClose();
  }, [menu, store, onClose]);

  const deleteNode = useCallback(() => {
    if (menu?.kind !== "node") return;
    store.removeNode(menu.nodeId);
    playRemoveNode();
    onClose();
  }, [menu, store, onClose]);

  const focusNode = useCallback(() => {
    if (menu?.kind !== "node") return;
    const node = getNode(menu.nodeId);
    if (node) {
      setCenter(node.position.x + 130, node.position.y + 60, { zoom: 1.2, duration: 400 });
    }
    onClose();
  }, [menu, getNode, setCenter, onClose]);

  const selectNode = useCallback(() => {
    if (menu?.kind !== "node") return;
    store.setSelectedNodeId(menu.nodeId);
    onClose();
  }, [menu, store, onClose]);

  const handleSelectAll = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 400 });
    onClose();
  }, [fitView, onClose]);

  const handleFullscreen = useCallback(() => {
    onToggleFullscreen();
    onClose();
  }, [onToggleFullscreen, onClose]);

  if (!menu) return null;

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: menu.position.x, top: menu.position.y }}
    >
      {menu.kind === "pane" && (
        <>
          <SubMenu icon={Cpu} label="Add Node">
            {NODE_TEMPLATES.map((tmpl, idx) => (
              <MenuItem
                key={tmpl.type}
                icon={tmpl.icon}
                iconColor={tmpl.iconColor}
                label={tmpl.label}
                onClick={() => addNodeAtPosition(idx)}
              />
            ))}
          </SubMenu>
          <Separator />
          <MenuItem
            icon={MousePointer2}
            label="Select All"
            shortcut="⌘A"
            onClick={handleSelectAll}
          />
          <MenuItem
            icon={LocateFixed}
            label="Fit View"
            onClick={handleFitView}
          />
          <MenuItem
            icon={isFullscreen ? Minimize : Maximize}
            label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            shortcut="F"
            onClick={handleFullscreen}
          />
          <Separator />
          <MenuItem
            icon={Clipboard}
            label="Paste"
            shortcut="⌘V"
            onClick={onClose}
          />
        </>
      )}

      {menu.kind === "node" && (
        <>
          <MenuItem
            icon={MousePointer2}
            label="Select & Configure"
            onClick={selectNode}
          />
          <MenuItem
            icon={LocateFixed}
            label="Focus Node"
            onClick={focusNode}
          />
          <Separator />
          <MenuItem
            icon={Copy}
            label="Duplicate"
            shortcut="⌘D"
            onClick={duplicateNode}
          />
          <Separator />
          <MenuItem
            icon={Trash2}
            label="Delete"
            shortcut="⌫"
            danger
            onClick={deleteNode}
          />
        </>
      )}
    </div>
  );
}
