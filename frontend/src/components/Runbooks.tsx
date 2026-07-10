import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Bot, FileOutput, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Loader2, Clock, Radio
} from 'lucide-react';
import type { Runbook, RunbookPhase, ExecutionLogEntry, ExecutionRecord } from '../types';
import { getRunbooks, getGraph, ApiClientError } from '../api/client';
import { LoadingState, ErrorState, EmptyState } from './States';
import { useAnalysis } from '../context/AnalysisContext';

// ─── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'rootsight_runbook_history';

function loadHistory(): Record<string, ExecutionRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHistory(history: Record<string, ExecutionRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* quota exceeded — ignore */ }
}

// ─── Outcome Engine ────────────────────────────────────────────────────────────
// Determines execution success/failure from graph evidence, not random chance.

interface GraphSnapshot {
  nodes: { id: string; name: string; type: string; status?: string }[];
  relationships: { source: string; target: string; type: string }[];
}

function deriveOutcome(pb: Runbook, graph: GraphSnapshot | null): {
  willSucceed: boolean;
  failAtStep?: number;
  reason: string;
} {
  if (!graph || graph.nodes.length === 0) {
    return { willSucceed: true, reason: 'No graph data — assuming nominal conditions.' };
  }

  // Find the node this runbook targets
  const targetName = (pb.relatedVendor || pb.relatedService || '').toLowerCase();
  const targetNode = graph.nodes.find((n) => n.name.toLowerCase() === targetName);

  // Count how many services depend on the target
  const dependentCount = targetNode
    ? graph.relationships.filter(
        (r) =>
          (r.target === targetNode.id || r.source === targetNode.id) &&
          ['DEPENDS_ON', 'USES_VENDOR', 'USES'].includes(r.type)
      ).length
    : 0;

  // Check if target node is already in a critical state
  const isCritical = targetNode?.status === 'critical';
  const isWarning = targetNode?.status === 'warning';

  // Check for incident nodes linked to target
  const hasLinkedIncident = targetNode
    ? graph.relationships.some(
        (r) => r.target === targetNode.id && r.type === 'CAUSED_BY'
      )
    : false;

  // Check confidence as a proxy for evidence quality
  const highConfidence = pb.confidence >= 85;

  // Decision matrix:
  // Critical node with many dependents + linked incident → high failure risk
  if (isCritical && dependentCount >= 3 && hasLinkedIncident) {
    // Failure at a middle step — the dependency chain is too tangled
    return {
      willSucceed: false,
      failAtStep: Math.ceil(pb.actions.length / 2),
      reason: `${targetNode?.name ?? 'Target'} is in critical state with ${dependentCount} active dependencies and a linked incident — partial remediation expected.`,
    };
  }

  // Critical node, no incident evidence → likely recoverable
  if (isCritical && !hasLinkedIncident) {
    return { willSucceed: true, reason: `${targetNode?.name ?? 'Target'} is critical but no active incident confirmed — recovery expected.` };
  }

  // Many dependents + warning state → elevated risk, fail near end
  if (isWarning && dependentCount >= 4) {
    return {
      willSucceed: false,
      failAtStep: pb.actions.length,
      reason: `${targetNode?.name ?? 'Target'} has ${dependentCount} downstream dependencies under warning — final validation step may not pass.`,
    };
  }

  // Database runbooks (manual) with low confidence → manual approval blocks auto path
  if (!pb.auto && !highConfidence) {
    return { willSucceed: true, reason: 'Manual execution approved with sufficient evidence.' };
  }

  // Default: healthy or no evidence of active degradation → success
  return { willSucceed: true, reason: 'Graph shows nominal conditions — execution expected to succeed.' };
}

// ─── Dynamic Confidence ────────────────────────────────────────────────────────
// Recalculates confidence on the frontend based on graph evidence at render time.

function computeConfidence(pb: Runbook, graph: GraphSnapshot | null): number {
  // Start from the backend-computed value as base
  let score = pb.confidence;
  if (!graph || graph.nodes.length === 0) return score;

  const targetName = (pb.relatedVendor || pb.relatedService || '').toLowerCase();
  const targetNode = graph.nodes.find((n) => n.name.toLowerCase() === targetName);
  if (!targetNode) return score;

  const deps = graph.relationships.filter(
    (r) => r.target === targetNode.id || r.source === targetNode.id
  ).length;

  const hasIncident = graph.relationships.some(
    (r) => r.target === targetNode.id && r.type === 'CAUSED_BY'
  );

  const incidentNodes = graph.nodes.filter((n) => n.type === 'Incident').length;

  if (hasIncident) score = Math.min(score + 8, 99);
  if (deps >= 5) score = Math.min(score + 5, 99);
  else if (deps >= 3) score = Math.min(score + 3, 99);
  if (incidentNodes >= 3) score = Math.min(score + 4, 99);
  if (targetNode.status === 'critical') score = Math.min(score + 6, 99);
  if (targetNode.status === 'warning') score = Math.min(score + 2, 99);

  return score;
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ phase, isAuto }: { phase: RunbookPhase; isAuto: boolean }) {
  const cfg: Record<RunbookPhase, { label: string; color: string }> = {
    waiting:        { label: 'Waiting for Trigger', color: 'text-zinc-500 border-zinc-700' },
    monitoring:     { label: 'Monitoring',           color: 'text-blue-400 border-blue-800' },
    idle:           { label: 'Ready to Execute',     color: 'text-amber-400 border-amber-800' },
    executing:      { label: 'Executing',            color: 'text-cyan-400 border-cyan-800' },
    success:        { label: isAuto ? 'Auto Executed' : 'Completed', color: 'text-cyan-400 border-cyan-800' },
    failed:         { label: 'Execution Failed',     color: 'text-red-400 border-red-800' },
    manual_pending: { label: 'Manual Approval Required', color: 'text-amber-400 border-amber-800' },
  };
  const { label, color } = cfg[phase] ?? cfg.idle;
  return (
    <span className={`text-xs font-mono uppercase tracking-widest border px-2 py-0.5 rounded ${color}`}>
      {label}
    </span>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── RunbookCard ───────────────────────────────────────────────────────────────

interface RunbookCardProps {
  pb: Runbook;
  index: number;
  graph: GraphSnapshot | null;
  savedRecord: ExecutionRecord | undefined;
  onSaveRecord: (r: ExecutionRecord) => void;
}

function RunbookCard({ pb, index, graph, savedRecord, onSaveRecord }: RunbookCardProps) {
  const confidence = computeConfidence(pb, graph);

  // Initialise phase from persisted history if available
  const initPhase = (): RunbookPhase => {
    if (savedRecord) return savedRecord.status === 'success' ? 'success' : 'failed';
    if (pb.auto) return 'waiting';
    if (!pb.auto && pb.status === 'Manual Approval Required') return 'manual_pending';
    return 'idle';
  };

  const [phase, setPhase] = useState<RunbookPhase>(initPhase);
  const [completedSteps, setCompletedSteps] = useState<number[]>(
    savedRecord?.status === 'success' ? pb.actions.map((_, i) => i) : []
  );
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [logs, setLogs] = useState<ExecutionLogEntry[]>(savedRecord?.logs ?? []);
  const [failedStep, setFailedStep] = useState<number | undefined>(savedRecord?.failedStep);
  const [completedAt, setCompletedAt] = useState<string | undefined>(savedRecord?.completedAt);
  const [duration, setDuration] = useState<number | undefined>(savedRecord?.duration);
  const [showLogs, setShowLogs] = useState(false);
  const abortRef = useRef(false);

  // Auto-exec lifecycle: waiting → monitoring → executing
  const hasAutoFired = useRef(false);
  useEffect(() => {
    if (!pb.auto || hasAutoFired.current || savedRecord) return;
    hasAutoFired.current = true;

    // Step 1: Waiting for Trigger (2s)
    const t1 = setTimeout(() => setPhase('monitoring'), 1500 + index * 300);
    // Step 2: Monitoring (2s)
    const t2 = setTimeout(() => execute(true), 3500 + index * 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLog(msg: string) {
    setLogs((prev) => [...prev, { time: fmtTime(new Date()), message: msg }]);
  }

  async function execute(isAuto = false) {
    if (phase === 'executing') return;
    abortRef.current = false;
    const startTime = Date.now();

    // Determine outcome from graph evidence — not random
    const outcome = deriveOutcome(pb, graph);

    setPhase('executing');
    setCompletedSteps([]);
    setCurrentStep(0);
    setFailedStep(undefined);
    setLogs([{ time: fmtTime(new Date()), message: `${isAuto ? 'Auto-execution' : 'Manual execution'} started` }]);
    setShowLogs(true);

    for (let i = 0; i < pb.actions.length; i++) {
      if (abortRef.current) return;
      const stepDelay = 2000 + Math.random() * 1500;

      setCurrentStep(i);
      addLog(`Step ${i + 1}: ${pb.actions[i]}`);
      await new Promise((res) => setTimeout(res, stepDelay));

      // Check if this is the step that fails (based on graph evidence, not random)
      if (!outcome.willSucceed && outcome.failAtStep === i + 1) {
        const at = new Date().toLocaleTimeString();
        const dur = Math.round((Date.now() - startTime) / 1000);
        setPhase('failed');
        setCurrentStep(null);
        setFailedStep(i + 1);
        setCompletedAt(at);
        setDuration(dur);
        addLog(`❌ Step ${i + 1} failed — ${outcome.reason}`);

        const record: ExecutionRecord = {
          runbookId: pb.id, status: 'failed',
          completedAt: at, duration: dur,
          logs: [...logs, { time: fmtTime(new Date()), message: `❌ Step ${i + 1} failed — ${outcome.reason}` }],
          failedStep: i + 1,
        };
        onSaveRecord(record);
        return;
      }

      setCompletedSteps((prev) => [...prev, i]);
      addLog(`✓ Step ${i + 1} completed`);
    }

    const at = new Date().toLocaleTimeString();
    const dur = Math.round((Date.now() - startTime) / 1000);
    setPhase('success');
    setCurrentStep(null);
    setCompletedAt(at);
    setDuration(dur);
    addLog('✓ Runbook executed successfully');

    const record: ExecutionRecord = {
      runbookId: pb.id, status: 'success',
      completedAt: at, duration: dur,
      logs: [...logs, { time: fmtTime(new Date()), message: '✓ Runbook executed successfully' }],
    };
    onSaveRecord(record);
  }

  function retry() {
    setPhase(pb.auto ? 'waiting' : 'idle');
    setCompletedSteps([]);
    setCurrentStep(null);
    setLogs([]);
    setFailedStep(undefined);
    setCompletedAt(undefined);
    setDuration(undefined);
    setShowLogs(false);
    abortRef.current = false;
    hasAutoFired.current = false;
  }

  const isExecuting = phase === 'executing';

  return (
    <motion.div
      key={pb.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-[#0d0d0f] border border-zinc-900 rounded p-5 relative overflow-hidden group"
    >
      {/* Auto-exec badge */}
      {pb.auto && (
        <div className="absolute top-0 right-0 p-3">
          <div className="flex items-center gap-1.5 text-xs md:text-sm font-mono text-cyan-500 uppercase tracking-widest font-bold">
            <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" /> Auto-Exec Enabled
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
          <FileOutput className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs md:text-sm font-mono bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 text-zinc-500 inline-block mb-1">
            {pb.id}
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-zinc-100">{pb.title}</h2>
          {pb.owningTeam && (
            <div className="text-xs font-mono text-zinc-600 mt-0.5">Owner: {pb.owningTeam}</div>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-4">
        <StatusBadge phase={phase} isAuto={pb.auto} />
      </div>

      {/* Trigger + Confidence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
        <div className="bg-zinc-950 p-4 rounded border border-zinc-900 border-l-amber-500 border-l-2">
          <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-widest mb-2">Trigger Condition</div>
          <div className="text-zinc-300 font-mono text-xs md:text-sm">{pb.trigger}</div>
        </div>
        <div className="bg-zinc-950 p-4 rounded border border-zinc-900 flex flex-col justify-center">
          <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-widest mb-2 flex justify-between">
            <span>AI Confidence Score</span>
            <span className="text-cyan-400 font-bold">{confidence}%</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 transition-all duration-700" style={{ width: `${confidence}%` }}></div>
          </div>
        </div>
      </div>

      {/* Execution Steps */}
      <div className="space-y-2 mb-6">
        <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-widest">Execution Steps</div>
        <ul className="space-y-2">
          {pb.actions.map((act, j) => {
            const done = completedSteps.includes(j);
            const active = currentStep === j;
            const failed = phase === 'failed' && failedStep === j + 1;
            return (
              <li key={j} className={`flex items-start gap-2 text-xs md:text-sm font-mono transition-colors
                ${done ? 'text-cyan-400' : active ? 'text-amber-400' : failed ? 'text-red-400' : 'text-zinc-400'}`}>
                <span className="mt-0.5 shrink-0">
                  {done    ? <CheckCircle className="w-3.5 h-3.5 text-cyan-500" /> :
                   failed  ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
                   active  ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" /> :
                   <span className="text-zinc-600">[{j + 1}]</span>}
                </span>
                {act}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Auto lifecycle indicator */}
      {pb.auto && (phase === 'waiting' || phase === 'monitoring') && (
        <div className="mb-4 flex items-center gap-2 font-mono text-xs text-zinc-500">
          {phase === 'waiting'
            ? <><Clock className="w-3.5 h-3.5 text-zinc-600 animate-pulse" /> Waiting for trigger condition...</>
            : <><Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> Monitoring — trigger detected, preparing to execute...</>}
        </div>
      )}

      {/* Success / Failed banners */}
      <AnimatePresence>
        {phase === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 rounded bg-cyan-500/10 border border-cyan-500/30 font-mono text-xs text-cyan-400 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>
              {pb.auto ? 'Auto Executed Successfully' : 'Runbook Executed Successfully'}
              {completedAt && ` — Completed at ${completedAt}`}
              {duration !== undefined && ` (${duration}s)`}
            </span>
          </motion.div>
        )}
        {phase === 'failed' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 font-mono text-xs text-red-400 flex items-center gap-2"
          >
            <XCircle className="w-4 h-4 shrink-0" />
            <span>Execution Failed — Failed at Step {failedStep} — Retry Available</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execution Log */}
      {logs.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors mb-2"
          >
            {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Execution Log ({logs.length} entries)
          </button>
          <AnimatePresence>
            {showLogs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-1 max-h-40 overflow-y-auto">
                  {logs.map((entry, k) => (
                    <div key={k} className="flex gap-3 font-mono text-xs">
                      <span className="text-zinc-600 shrink-0">{entry.time}</span>
                      <span className="text-zinc-400">{entry.message}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Execution History */}
      {savedRecord && (
        <div className="mb-4 font-mono text-xs text-zinc-600 flex flex-wrap gap-4">
          <span>Last Executed: {savedRecord.completedAt}</span>
          <span className={savedRecord.status === 'success' ? 'text-cyan-600' : 'text-red-600'}>
            {savedRecord.status === 'success' ? '✓ Success' : `✗ Failed at Step ${savedRecord.failedStep}`}
          </span>
          <span>Duration: {savedRecord.duration}s</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-5 border-t border-zinc-900">
        <StatusBadge phase={phase} isAuto={pb.auto} />

        {pb.auto ? (
          <div className="px-5 py-2.5 font-bold uppercase tracking-wider text-xs rounded flex items-center gap-2 bg-zinc-800 text-zinc-500 cursor-not-allowed">
            <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" />
            Managed by AI Agent
          </div>
        ) : phase === 'failed' ? (
          <button
            onClick={retry}
            className="px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-colors rounded flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950"
          >
            <Play className="w-3.5 h-3.5 md:w-4 md:h-4" /> Retry
          </button>
        ) : phase === 'success' ? (
          <button
            onClick={retry}
            className="px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-colors rounded flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
          >
            <Play className="w-3.5 h-3.5 md:w-4 md:h-4" /> Re-run
          </button>
        ) : (
          <button
            onClick={() => execute(false)}
            disabled={isExecuting}
            className={`px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-colors rounded flex items-center gap-2
              ${isExecuting
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'}`}
          >
            {isExecuting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Executing...</>
              : <><Play className="w-3.5 h-3.5 md:w-4 md:h-4" /> Execute Manually</>}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Runbooks Page ────────────────────────────────────────────────────────

export default function Runbooks() {
  // Both runbooks and graph are shared via AnalysisContext with Dashboard and
  // Architecture, so returning to this section reuses whatever was already
  // loaded instead of re-fetching it. loading/error stay local — they only
  // describe this view's own fetch-in-flight UI.
  const { runbooks: playbooks, setRunbooks: setPlaybooks, runbooksError, setRunbooksError, graph, setGraph } = useAnalysis();
  const [loading, setLoading] = useState(() => playbooks.length === 0 || !graph);
  const [history, setHistory] = useState<Record<string, ExecutionRecord>>(loadHistory);
  const error = runbooksError ? { message: runbooksError } : null;

  const load = async () => {
    setLoading(true);
    setRunbooksError(null);
    try {
      const [rbRes, graphRes] = await Promise.allSettled([getRunbooks(), getGraph()]);
      if (rbRes.status === 'fulfilled') setPlaybooks(rbRes.value.runbooks);
      else {
        const err = rbRes.reason;
        setRunbooksError(err instanceof ApiClientError ? err.message : 'Failed to load remediation runbooks.');
      }
      if (graphRes.status === 'fulfilled') setGraph(graphRes.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playbooks.length > 0 && graph) {
      // Both pieces already cached — nothing to do.
      setLoading(false);
      return;
    }
    load();
    // Intentionally runs once per mount only — the guard above, not this
    // dependency array, decides whether a fetch actually happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaveRecord(record: ExecutionRecord) {
    setHistory((prev) => {
      const next = { ...prev, [record.runbookId]: record };
      saveHistory(next);
      return next;
    });
  }

  return (
    <div className="flex-1 w-full pt-10 px-4 md:px-8 pb-8 overflow-y-auto bg-zinc-950">
      <div className="w-full space-y-6">
        <header className="mb-8">
          <h1 className="font-display font-bold text-zinc-100 mb-1 uppercase tracking-tight text-3xl md:text-4xl lg:text-5xl">
            AI Remediation Runbooks
          </h1>
          <p className="font-mono text-zinc-400 text-sm md:text-base">
            Automated playbooks generated from historical incident graphs.
          </p>
        </header>

        {loading ? (
          <div className="h-[50vh]"><LoadingState label="Generating runbooks..." /></div>
        ) : error ? (
          <div className="h-[50vh]"><ErrorState message={error.message} code={error.code} onRetry={load} /></div>
        ) : playbooks.length === 0 ? (
          <div className="h-[50vh]"><EmptyState label="No runbooks available yet." /></div>
        ) : (
          <div className="space-y-4">
            {playbooks.map((pb, i) => (
              <RunbookCard
                key={pb.id}
                pb={pb}
                index={i}
                graph={graph}
                savedRecord={history[pb.id]}
                onSaveRecord={handleSaveRecord}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}