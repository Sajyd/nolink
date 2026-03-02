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
  if (resolvedStep.logicCondition) {
    resolvedStep.logicCondition = {
      ...resolvedStep.logicCondition,
      leftOperand: cp(resolvedStep.logicCondition.leftOperand || ""),
      rightOperand: cp(resolvedStep.logicCondition.rightOperand || ""),
    };
  }
  if (resolvedStep.utilityConfig) {
    resolvedStep.utilityConfig = {
      ...resolvedStep.utilityConfig,
      operand: resolvedStep.utilityConfig.operand ? cp(resolvedStep.utilityConfig.operand) : undefined,
      replacement: resolvedStep.utilityConfig.replacement ? cp(resolvedStep.utilityConfig.replacement) : undefined,
      itemTemplate: resolvedStep.utilityConfig.itemTemplate ? cp(resolvedStep.utilityConfig.itemTemplate) : undefined,
    };
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
  const stepOutputMap = new Map<string, StepOutput>();

  const visibleSteps = stepDefs.filter((s) => s.stepType !== "INPUT" && s.stepType !== "OUTPUT");
  const totalVisible = visibleSteps.length;
  const visibleCounter = { value: 0 };

  // Kahn's algorithm: track remaining in-degree per node.
  // A node only becomes ready when ALL its incoming edges have been satisfied.
  const remainingInDegree = new Map<string, number>();
  for (const s of stepDefs) remainingInDegree.set(s.id, 0);
  for (const e of edges) {
    if (remainingInDegree.has(e.target)) {
      remainingInDegree.set(e.target, (remainingInDegree.get(e.target) || 0) + 1);
    }
  }

  // Nodes whose branch was killed by a logic gate — they will never execute
  const skipped = new Set<string>();

  const executed = new Set<string>();
  const ready: string[] = [];

  // Seed with in-degree-0 nodes (sorted by order for determinism)
  for (const s of [...stepDefs].sort((a, b) => a.order - b.order)) {
    if ((remainingInDegree.get(s.id) || 0) === 0) ready.push(s.id);
  }

  // Helper: decrement in-degree and enqueue if ready
  function release(targetId: string) {
    if (skipped.has(targetId) || executed.has(targetId)) return;
    const cur = remainingInDegree.get(targetId) ?? 0;
    const next = cur - 1;
    remainingInDegree.set(targetId, next);
    if (next <= 0 && !ready.includes(targetId)) {
      ready.push(targetId);
    }
  }

  // Helper: recursively mark a node and all its descendants as skipped
  function skipBranch(nodeId: string) {
    if (skipped.has(nodeId) || executed.has(nodeId)) return;
    skipped.add(nodeId);
    const children = adjacency.get(nodeId) || [];
    for (const child of children) {
      // Only skip if ALL parents of this child are either skipped or are the
      // logic gate that chose not to go here. We approximate by decrementing
      // and only skipping if the node can never become ready.
      const cur = remainingInDegree.get(child.target) ?? 0;
      remainingInDegree.set(child.target, cur - 1);
      // If remaining is still > 0, another parent may still release it — don't skip.
      // If remaining <= 0 and it hasn't been released to ready, skip it.
      if ((remainingInDegree.get(child.target) ?? 0) <= 0 && !ready.includes(child.target) && !executed.has(child.target)) {
        skipBranch(child.target);
      }
    }
  }

  while (ready.length > 0) {
    if (callbacks?.isAborted?.()) break;

    const nodeId = ready.shift()!;
    if (executed.has(nodeId) || skipped.has(nodeId)) continue;
    executed.add(nodeId);

    const step = stepMap.get(nodeId);
    if (!step) continue;

    let currentInput = mergeParentOutputs(nodeId, parentMap, stepOutputMap, initialInput);

    if (step.stepType === "INPUT" && perStepInputMap[step.id]) {
      currentInput = perStepInputMap[step.id];
    }

    if (step.customParams) {
      for (const cp of step.customParams) {
        if (cp.name) customParamMap[cp.name] = cp.value;
      }
    }

    // ─── LOGIC gate: evaluate condition and route ────────
    if (step.stepType === "LOGIC") {
      const resolvedLogicStep = resolveStep(step, customParamMap);
      const condResult = evaluateLogicCondition(resolvedLogicStep, currentInput);
      stepOutputMap.set(step.id, currentInput);
      customParamMap[`step_${step.id}_output`] = currentInput.text;

      const logicMode = step.logicMode || "condition";
      const children = adjacency.get(step.id) || [];

      if (logicMode === "condition") {
        const activeHandle = condResult ? "true" : "false";
        const killedHandle = condResult ? "false" : "true";

        // Release children on the chosen handle
        for (const child of children) {
          if (child.sourceHandle === activeHandle) {
            release(child.target);
          }
        }
        // Skip children on the unchosen handle
        for (const child of children) {
          if (child.sourceHandle === killedHandle) {
            skipBranch(child.target);
          }
        }
      } else if (logicMode === "while_loop") {
        const loopTargets = children.filter((c) => c.sourceHandle === "loop");
        const doneTargets = children.filter((c) => c.sourceHandle === "done");

        if (condResult && loopTargets.length > 0) {
          let loopInput = currentInput;

          for (let iter = 0; iter < MAX_WHILE_ITERATIONS; iter++) {
            if (callbacks?.isAborted?.()) break;

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

            const resolvedLoopStep = resolveStep(step, customParamMap);
            const stillTrue = evaluateLogicCondition(resolvedLoopStep, loopInput);
            if (!stillTrue) break;
          }

          stepOutputMap.set(step.id, loopInput);
          customParamMap[`step_${step.id}_output`] = loopInput.text;

          for (const dt of doneTargets) release(dt.target);
          for (const lt of loopTargets) {
            executed.add(lt.target);
          }
        } else {
          for (const dt of doneTargets) release(dt.target);
          for (const lt of loopTargets) skipBranch(lt.target);
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

      // Release all children
      const children = adjacency.get(step.id) || [];
      for (const child of children) release(child.target);
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

      // On error, still release children so downstream nodes can attempt to run.
      // The errored step's output won't be in stepOutputMap, so downstream
      // mergeParentOutputs will use fallback.
      const children = adjacency.get(step.id) || [];
      for (const child of children) release(child.target);
    }
  }

  return allResults;
}
