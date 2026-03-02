import {
  executeStep,
  evaluateLogicCondition,
  type StepDefinition,
  type FileInput,
  type StepResult,
} from "@/lib/ai-engine";

const MAX_WHILE_ITERATIONS = 50;

interface EdgeDef {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface StepOutput {
  text: string;
  files: FileInput[];
}

export interface GraphExecutorCallbacks {
  onStepStart?: (step: StepDefinition, visibleIndex: number, totalVisible: number) => void;
  onStepComplete?: (result: StepResult, nextInput: StepOutput, visibleIndex: number, totalVisible: number) => void;
  onStepError?: (result: StepResult, visibleIndex: number, totalVisible: number) => void;
  onIntermediateResult?: (allResults: StepResult[]) => Promise<void>;
  isAborted?: () => boolean;
}

function buildAdjacency(edges: EdgeDef[]): Map<string, { target: string; sourceHandle: string | null }[]> {
  const adj = new Map<string, { target: string; sourceHandle: string | null }[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push({ target: e.target, sourceHandle: e.sourceHandle ?? null });
  }
  return adj;
}

function buildInDegree(stepIds: string[], edges: EdgeDef[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const id of stepIds) deg.set(id, 0);
  for (const e of edges) {
    if (deg.has(e.target)) deg.set(e.target, (deg.get(e.target) || 0) + 1);
  }
  return deg;
}

function buildParentMap(edges: EdgeDef[]): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  for (const e of edges) {
    if (!parents.has(e.target)) parents.set(e.target, []);
    parents.get(e.target)!.push(e.source);
  }
  return parents;
}

function mergeParentOutputs(
  stepId: string,
  parentMap: Map<string, string[]>,
  stepOutputMap: Map<string, StepOutput>,
  fallbackInput: StepOutput
): StepOutput {
  const parents = parentMap.get(stepId);
  if (!parents || parents.length === 0) return fallbackInput;

  const parentOutputs = parents.map((pid) => stepOutputMap.get(pid)).filter(Boolean) as StepOutput[];
  if (parentOutputs.length === 0) return fallbackInput;

  const mergedText = parentOutputs.map((o) => o.text).filter(Boolean).join("\n\n");
  const mergedFiles = parentOutputs.flatMap((o) => o.files || []);
  const result: StepOutput = {
    text: mergedText || fallbackInput.text,
    files: [...mergedFiles, ...fallbackInput.files],
  };
  const seen = new Set<string>();
  result.files = result.files.filter((f) => {
    if (seen.has(f.url)) return false;
    seen.add(f.url);
    return true;
  });
  return result;
}

function resolveCustomParams(text: string, customParamMap: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (m, name) =>
    name === "input" ? m : customParamMap[name] !== undefined ? customParamMap[name] : m
  );
}

function resolveStep(step: StepDefinition, customParamMap: Record<string, string>): StepDefinition {
  const resolvedStep = { ...step };
  const cp = (t: string) => resolveCustomParams(t, customParamMap);

  if (resolvedStep.prompt) resolvedStep.prompt = cp(resolvedStep.prompt);
  if (resolvedStep.systemPrompt) resolvedStep.systemPrompt = cp(resolvedStep.systemPrompt);
  if (resolvedStep.params) {
    resolvedStep.params = { ...resolvedStep.params };
    for (const [k, v] of Object.entries(resolvedStep.params)) {
      if (typeof v === "string") {
        (resolvedStep.params as Record<string, unknown>)[k] = cp(v);
      }
      if (Array.isArray(v)) {
        (resolvedStep.params as Record<string, unknown>)[k] = v.map((item) =>
          typeof item === "string" ? cp(item) : item
        );
      }
    }
  }
  if (resolvedStep.customApiUrl) resolvedStep.customApiUrl = cp(resolvedStep.customApiUrl);
  if (resolvedStep.customApiParams) {
    resolvedStep.customApiParams = resolvedStep.customApiParams.map((p) => ({ key: p.key, value: cp(p.value) }));
  }
  if (resolvedStep.customApiHeaders) {
    resolvedStep.customApiHeaders = resolvedStep.customApiHeaders.map((h) => ({ key: h.key, value: cp(h.value) }));
  }
  if (resolvedStep.customFalParams) {
    resolvedStep.customFalParams = resolvedStep.customFalParams.map((p) => ({ key: p.key, value: cp(p.value) }));
  }
  if (resolvedStep.customReplicateParams) {
    resolvedStep.customReplicateParams = resolvedStep.customReplicateParams.map((p) => ({ key: p.key, value: cp(p.value) }));
  }
  return resolvedStep;
}

function resolveFileBindings(
  step: StepDefinition,
  currentInput: StepOutput,
  customParamMap: Record<string, string>
): StepOutput {
  if (!step.fileBindings || step.fileBindings.length === 0) return currentInput;
  const extraFiles: FileInput[] = [];
  for (const binding of step.fileBindings) {
    const url = customParamMap[binding];
    if (!url) continue;
    const parts = binding.split("_");
    const fileType = parts[parts.length - 1] || "document";
    extraFiles.push({ url, type: fileType, name: binding });
  }
  if (extraFiles.length === 0) return currentInput;
  return { ...currentInput, files: [...currentInput.files, ...extraFiles] };
}

/**
 * Execute a subgraph (used for while loop body).
 * Given a starting node and the full graph context, executes nodes in topological order
 * reachable from that starting node, stopping before re-entering the logic gate.
 */
async function executeSubgraph(
  startNodeId: string,
  logicGateId: string,
  stepMap: Map<string, StepDefinition>,
  adjacency: Map<string, { target: string; sourceHandle: string | null }[]>,
  inputData: StepOutput,
  customParamMap: Record<string, string>,
  stepOutputMap: Map<string, StepOutput>,
  allResults: StepResult[],
  callbacks?: GraphExecutorCallbacks,
  visibleCounter?: { value: number },
  totalVisible?: number,
): Promise<StepOutput> {
  const queue: string[] = [startNodeId];
  const visited = new Set<string>();
  let lastOutput = inputData;

  while (queue.length > 0) {
    if (callbacks?.isAborted?.()) break;

    const nodeId = queue.shift()!;
    if (visited.has(nodeId) || nodeId === logicGateId) continue;
    visited.add(nodeId);

    const step = stepMap.get(nodeId);
    if (!step) continue;

    let nodeInput = stepOutputMap.has(nodeId)
      ? stepOutputMap.get(nodeId)!
      : inputData;

    if (step.stepType === "INPUT") continue;

    if (step.customParams) {
      for (const cp of step.customParams) {
        if (cp.name) customParamMap[cp.name] = cp.value;
      }
    }

    const resolvedStep = resolveStep(step, customParamMap);
    nodeInput = resolveFileBindings(resolvedStep, nodeInput, customParamMap);

    const isVisible = step.stepType !== "INPUT" && step.stepType !== "OUTPUT";

    if (isVisible && callbacks?.onStepStart && visibleCounter && totalVisible) {
      visibleCounter.value++;
      callbacks.onStepStart(step, visibleCounter.value, totalVisible);
    }

    try {
      const result = await executeStep(resolvedStep, nodeInput);
      const { _nextInput, ...stepResult } = result;
      allResults.push(stepResult);
      lastOutput = _nextInput;

      stepOutputMap.set(step.id, _nextInput);
      customParamMap[`step_${step.id}_output`] = _nextInput.text;
      for (const f of _nextInput.files) {
        const key = `step_${step.id}_${f.type}`;
        if (!customParamMap[key]) customParamMap[key] = f.url;
      }

      if (isVisible && callbacks?.onStepComplete && visibleCounter && totalVisible) {
        callbacks.onStepComplete(stepResult, _nextInput, visibleCounter.value, totalVisible);
      }

      if (callbacks?.onIntermediateResult) {
        await callbacks.onIntermediateResult(allResults);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      const stepResult: StepResult = {
        stepId: step.id,
        stepName: step.name,
        stepType: step.stepType,
        output: `Error: ${errMsg}`,
        outputType: step.outputType,
        duration: 0,
      };
      allResults.push(stepResult);
      if (isVisible && callbacks?.onStepError && visibleCounter && totalVisible) {
        callbacks.onStepError(stepResult, visibleCounter.value, totalVisible);
      }
      return lastOutput;
    }

    // Enqueue children except the logic gate itself (that's handled by the while loop)
    const children = adjacency.get(nodeId) || [];
    for (const child of children) {
      if (child.target !== logicGateId && !visited.has(child.target)) {
        stepOutputMap.set(child.target, lastOutput);
        queue.push(child.target);
      }
    }
  }

  return lastOutput;
}

export async function executeWorkflowGraph(
  stepDefs: StepDefinition[],
  edges: EdgeDef[],
  initialInput: StepOutput,
  perStepInputMap: Record<string, StepOutput>,
  customParamMap: Record<string, string>,
  callbacks?: GraphExecutorCallbacks,
): Promise<StepResult[]> {
  const allResults: StepResult[] = [];
  const stepMap = new Map<string, StepDefinition>();
  for (const s of stepDefs) stepMap.set(s.id, s);

  const adjacency = buildAdjacency(edges);
  const parentMap = buildParentMap(edges);
  const inDegree = buildInDegree(stepDefs.map((s) => s.id), edges);
  const stepOutputMap = new Map<string, StepOutput>();

  const visibleSteps = stepDefs.filter((s) => s.stepType !== "INPUT" && s.stepType !== "OUTPUT");
  const totalVisible = visibleSteps.length;
  const visibleCounter = { value: 0 };

  // Start from nodes with in-degree 0, sorted by order
  const startNodes = stepDefs
    .filter((s) => (inDegree.get(s.id) || 0) === 0)
    .sort((a, b) => a.order - b.order);

  const queue: string[] = startNodes.map((s) => s.id);
  const executed = new Set<string>();

  while (queue.length > 0) {
    if (callbacks?.isAborted?.()) break;

    const nodeId = queue.shift()!;
    if (executed.has(nodeId)) continue;
    executed.add(nodeId);

    const step = stepMap.get(nodeId);
    if (!step) continue;

    // Get input for this node
    let currentInput = mergeParentOutputs(nodeId, parentMap, stepOutputMap, initialInput);

    // For INPUT steps with per-step data, inject the specific user input
    if (step.stepType === "INPUT" && perStepInputMap[step.id]) {
      currentInput = perStepInputMap[step.id];
    }

    if (step.customParams) {
      for (const cp of step.customParams) {
        if (cp.name) customParamMap[cp.name] = cp.value;
      }
    }

    // ─── LOGIC gate: route without executing ─────────────
    if (step.stepType === "LOGIC") {
      const condResult = evaluateLogicCondition(step, currentInput);
      stepOutputMap.set(step.id, currentInput); // pass-through

      const logicMode = step.logicMode || "condition";
      const children = adjacency.get(step.id) || [];

      if (logicMode === "condition") {
        const handleToFollow = condResult ? "true" : "false";
        for (const child of children) {
          if (child.sourceHandle === handleToFollow && !executed.has(child.target)) {
            stepOutputMap.set(child.target, currentInput);
            queue.push(child.target);
          }
        }
      } else if (logicMode === "while_loop") {
        const loopTargets = children.filter((c) => c.sourceHandle === "loop");
        const doneTargets = children.filter((c) => c.sourceHandle === "done");

        if (condResult && loopTargets.length > 0) {
          let loopInput = currentInput;

          for (let iter = 0; iter < MAX_WHILE_ITERATIONS; iter++) {
            if (callbacks?.isAborted?.()) break;

            // Execute the loop body subgraph
            for (const lt of loopTargets) {
              stepOutputMap.set(lt.target, loopInput);
            }
            const bodyOutput = await executeSubgraph(
              loopTargets[0].target,
              step.id,
              stepMap,
              adjacency,
              loopInput,
              customParamMap,
              stepOutputMap,
              allResults,
              callbacks,
              visibleCounter,
              totalVisible,
            );
            loopInput = bodyOutput;

            // Re-evaluate condition with new input
            const fakeStep = { ...step };
            const stillTrue = evaluateLogicCondition(fakeStep, loopInput);
            if (!stillTrue) break;
          }

          stepOutputMap.set(step.id, loopInput);

          // After loop exits, follow "done" branch
          for (const dt of doneTargets) {
            if (!executed.has(dt.target)) {
              stepOutputMap.set(dt.target, loopInput);
              queue.push(dt.target);
            }
          }
        } else {
          // Condition is false from the start — skip loop, go to "done"
          for (const dt of doneTargets) {
            if (!executed.has(dt.target)) {
              stepOutputMap.set(dt.target, currentInput);
              queue.push(dt.target);
            }
          }
        }
      }
      continue;
    }

    // ─── Regular step execution ──────────────────────────
    const resolvedStep = resolveStep(step, customParamMap);
    currentInput = resolveFileBindings(resolvedStep, currentInput, customParamMap);

    const isVisible = step.stepType !== "INPUT" && step.stepType !== "OUTPUT";

    if (isVisible && callbacks?.onStepStart) {
      visibleCounter.value++;
      callbacks.onStepStart(step, visibleCounter.value, totalVisible);
    }

    try {
      const result = await executeStep(resolvedStep, currentInput);
      const { _nextInput, ...stepResult } = result;
      allResults.push(stepResult);

      stepOutputMap.set(step.id, _nextInput);
      customParamMap[`step_${step.id}_output`] = _nextInput.text;
      for (const f of _nextInput.files) {
        const key = `step_${step.id}_${f.type}`;
        if (!customParamMap[key]) customParamMap[key] = f.url;
      }

      if (isVisible && callbacks?.onStepComplete) {
        callbacks.onStepComplete(stepResult, _nextInput, visibleCounter.value, totalVisible);
      }

      if (callbacks?.onIntermediateResult) {
        await callbacks.onIntermediateResult(allResults);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      const stepResult: StepResult = {
        stepId: step.id,
        stepName: step.name,
        stepType: step.stepType,
        output: `Error: ${errMsg}`,
        outputType: step.outputType,
        duration: 0,
      };
      allResults.push(stepResult);

      if (isVisible && callbacks?.onStepError) {
        callbacks.onStepError(stepResult, visibleCounter.value, totalVisible);
      }
      break;
    }

    // Enqueue children (all outgoing edges for non-logic nodes)
    const children = adjacency.get(step.id) || [];
    for (const child of children) {
      if (!executed.has(child.target)) {
        queue.push(child.target);
      }
    }
  }

  return allResults;
}
