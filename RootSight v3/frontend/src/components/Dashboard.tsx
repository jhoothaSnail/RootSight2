import { useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Brain, Activity, Zap, Network, User, Cpu, FileWarning, Fingerprint, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import type { GraphResponse, ScenarioName } from '../types';
import { getGraph, simulate, analyze, ApiClientError } from '../api/client';
import { SCENARIO_NAMES } from '../data/scenarios';
import { useAnalysis } from '../context/AnalysisContext';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface LaidOutNode {
  id: string;
  name: string;
  type: string;
  status?: string;
  x: number;
  y: number;
}

const VIEW_W = 1000;

// Layered topology: teams on top, services in the middle (wrapped into rows),
// vendors + databases anchored at the bottom. Deterministic so the graph stays
// stable across renders.
function layoutGraph(graph: GraphResponse): { nodes: LaidOutNode[]; height: number } {
  const teams = graph.nodes.filter((n) => n.type === 'Team');
  const services = graph.nodes.filter((n) => n.type === 'Service');
  const sinks = graph.nodes.filter((n) => n.type === 'Vendor' || n.type === 'Database');
  const others = graph.nodes.filter(
    (n) => !['Team', 'Service', 'Vendor', 'Database'].includes(n.type)
  );

  const positions = new Map<string, { x: number; y: number }>();
  const spread = (count: number, idx: number) => ((idx + 1) * VIEW_W) / (count + 1);

  const topY = 70;
  teams.forEach((n, i) => positions.set(n.id, { x: spread(teams.length, i), y: topY }));

  const perRow = 6;
  const serviceRows = Math.max(1, Math.ceil(services.length / perRow));
  const serviceStartY = 200;
  const rowGap = 120;
  services.forEach((n, i) => {
    const row = Math.floor(i / perRow);
    const rowItems = Math.min(perRow, services.length - row * perRow);
    const idxInRow = i % perRow;
    positions.set(n.id, { x: spread(rowItems, idxInRow), y: serviceStartY + row * rowGap });
  });

  const sinkY = serviceStartY + serviceRows * rowGap + 30;
  sinks.forEach((n, i) => positions.set(n.id, { x: spread(sinks.length, i), y: sinkY }));
  others.forEach((n, i) => positions.set(n.id, { x: spread(others.length, i), y: topY }));

  const nodes: LaidOutNode[] = graph.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    status: n.status,
    ...(positions.get(n.id) || { x: VIEW_W / 2, y: topY }),
  }));

  return { nodes, height: sinkY + 70 };
}

const EVENT_ACCENT: Record<string, string> = {
  alert: 'border-red-500 bg-red-500/5 text-red-400',
  log: 'border-zinc-600 bg-zinc-800/30 text-zinc-400',
  ticket: 'border-amber-500 bg-amber-500/5 text-amber-400',
  complaint: 'border-cyan-500 bg-cyan-500/5 text-cyan-400',
};

export default function Dashboard() {
  const {
    graph, setGraph,
    graphLoading, setGraphLoading,
    graphError, setGraphError,
    scenario, setScenario,
    events, setEvents,
    analysis, setAnalysis,
    phase, setPhase,
    runError, setRunError,
  } = useAnalysis();

  const loadGraph = useCallback(async () => {
    setGraphLoading(true);
    setGraphError(null);
    try {
      const g = await getGraph();
      setGraph(g);
    } catch (err) {
      setGraphError(err instanceof ApiClientError ? err.message : 'Failed to load dependency graph.');
    } finally {
      setGraphLoading(false);
    }
  }, [setGraph, setGraphLoading, setGraphError]);

  useEffect(() => {
    // Only fetch once; persisted graph survives section switches via context.
    if (!graph && !graphLoading) loadGraph();
  }, [graph, graphLoading, loadGraph]);

  const { nodes: laidOut, height: viewH } = useMemo(
    () => (graph ? layoutGraph(graph) : { nodes: [], height: 600 }),
    [graph]
  );
  const posById = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);

  const analysisComplete = phase === 'done' && !!analysis;

  // Resolve highlighted node ids from the analysis (which references display names).
  const { rootId, affectedIds } = useMemo(() => {
    if (!analysis || laidOut.length === 0) return { rootId: null as string | null, affectedIds: new Set<string>() };
    const nameToId = new Map<string, string>();
    laidOut.forEach((n) => nameToId.set(n.name.toLowerCase(), n.id));
    const root = nameToId.get(analysis.rootCause.toLowerCase()) ?? null;
    const affected = new Set<string>();
    const names: string[] = [...analysis.affectedServices, ...(analysis.affectedVendors || []), ...analysis.affectedTeams];
    names.forEach((name) => {
      const id = nameToId.get(name.toLowerCase());
      if (id) affected.add(id);
    });
    return { rootId: root, affectedIds: affected };
  }, [analysis, laidOut]);

  const nodeState = (id: string): 'root' | 'affected' | 'normal' => {
    if (!analysisComplete) return 'normal';
    if (id === rootId) return 'root';
    if (affectedIds.has(id)) return 'affected';
    return 'normal';
  };

  const runScenario = async () => {
    if (phase === 'simulating' || phase === 'analyzing') return;
    setRunError(null);
    setAnalysis(null);
    setEvents([]);
    setPhase('simulating');

    try {
      const sim = await simulate(scenario);
      for (const ev of sim.events) {
        await sleep(450);
        setEvents((prev) => [ev, ...prev]);
      }
      setPhase('analyzing');
      await sleep(800);
      const result = await analyze(sim.events, scenario);
      setAnalysis(result);
      setPhase('done');
    } catch (err) {
      setRunError(err instanceof ApiClientError ? err.message : 'Incident analysis failed. Please retry.');
      setPhase('idle');
    }
  };

  const reset = () => {
    setEvents([]);
    setAnalysis(null);
    setPhase('idle');
    setRunError(null);
  };

  const busy = phase === 'simulating' || phase === 'analyzing';

  return (
    <div className="flex-1 w-full py-6 px-4 lg:py-10 lg:px-6 flex flex-col gap-4 overflow-y-auto overflow-x-hidden bg-zinc-950">

      <header className="flex justify-between items-end mb-2 shrink-0">
         <div>
            <h1 className="font-display font-bold text-white mb-1 tracking-tight text-3xl md:text-4xl">Analysis Engine</h1>
            <p className="font-mono text-sm md:text-base text-zinc-400">Real-time incident ingestion and root cause mapping</p>
         </div>
      </header>

      <div className="flex flex-col xl:grid xl:grid-cols-12 gap-4 flex-1 pb-10 xl:pb-0 min-h-max xl:min-h-0">

        {/* PANEL 1: INGESTION */}
        <div className="xl:col-span-3 h-[360px] lg:h-[460px] xl:min-h-[500px] flex flex-col bg-[#0d0d0f] border border-zinc-900 rounded relative overflow-hidden shrink-0">
          <div className="p-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
            <h2 className="font-mono text-sm uppercase tracking-widest font-semibold text-zinc-300 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" /> Pipeline
            </h2>
            {analysisComplete && (
              <button
                onClick={reset}
                className="px-3 py-1.5 text-xs uppercase font-bold tracking-wider rounded bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          {/* Scenario controls */}
          <div className="p-3 border-b border-zinc-900 flex flex-col gap-2 bg-zinc-950/30">
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Incident Scenario</label>
            <div className="flex gap-2">
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as ScenarioName)}
                disabled={busy}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-2 text-xs md:text-sm text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
              >
                {SCENARIO_NAMES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={runScenario}
                disabled={busy}
                className="px-3 py-2 text-xs uppercase font-bold tracking-wider rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {phase === 'simulating' ? 'Injecting' : phase === 'analyzing' ? 'Analyzing' : 'Run'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs md:text-sm custom-scrollbar">
            {runError && (
              <div className="p-3 rounded bg-red-500/5 border border-red-500/30 text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{runError}</span>
              </div>
            )}
            <AnimatePresence>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded border-l-2 text-zinc-300 ${EVENT_ACCENT[event.type] || EVENT_ACCENT.log}`}
                >
                  <div className="text-[10px] uppercase opacity-70 mb-1 flex justify-between gap-2">
                    <span>{event.source || event.type}</span>
                    <span>{event.type}</span>
                  </div>
                  <div className="text-zinc-300">{event.message}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {phase === 'idle' && events.length === 0 && !runError && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 py-10">
                <FileWarning className="w-6 h-6 opacity-50" />
                <span>Select a scenario and run to begin.</span>
              </div>
            )}
          </div>

          {analysisComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 m-3 rounded bg-teal-500/10 border border-teal-500/30 text-teal-400"
            >
              <div className="flex items-center gap-2 font-mono text-sm font-semibold mb-1">
                <Brain className="w-4 h-4" /> Pattern Locked
              </div>
              <div className="text-xs md:text-sm text-zinc-300">Incident cluster correlated and root cause isolated.</div>
            </motion.div>
          )}
        </div>

        {/* PANEL 2: GRAPH MAPPING */}
        <div className="xl:col-span-6 h-[400px] lg:h-[500px] xl:min-h-[500px] bg-[#0d0d0f] border border-zinc-900 rounded relative overflow-hidden flex flex-col shrink-0">
           <div className="p-3 border-b border-zinc-900 flex items-center justify-between z-10 bg-zinc-950/50 backdrop-blur">
            <h2 className="font-mono text-sm md:text-base uppercase tracking-widest font-semibold text-zinc-300 flex items-center gap-2">
              <Network className="w-4 h-4 md:w-5 md:h-5 text-cyan-500" /> Topographic Network
            </h2>
          </div>
          <div className="flex-1 relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 via-zinc-950 to-zinc-950">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:2rem_2rem] border-zinc-800"></div>

            {graphLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="font-mono text-xs uppercase tracking-widest animate-pulse">Loading topology...</span>
              </div>
            ) : graphError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400 px-6 text-center">
                <AlertTriangle className="w-7 h-7 text-red-500" />
                <span className="text-sm">{graphError}</span>
                <button onClick={loadGraph} className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono uppercase tracking-wider hover:bg-zinc-800">Retry</button>
              </div>
            ) : (
              <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VIEW_W} ${viewH}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                  <filter id="glow-amber"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <filter id="glow-cyan"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>

                {graph?.relationships.map((edge, i) => {
                  const s = posById.get(edge.source);
                  const t = posById.get(edge.target);
                  if (!s || !t) return null;
                  const active = analysisComplete && (
                    edge.source === rootId || edge.target === rootId ||
                    affectedIds.has(edge.source) || affectedIds.has(edge.target)
                  );
                  return (
                    <motion.line
                      key={i}
                      x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                      stroke={active ? '#f59e0b' : '#27272a'}
                      strokeWidth={active ? 2 : 1}
                      animate={{
                        stroke: active ? ['#f59e0b', '#fbbf24', '#f59e0b'] : '#27272a',
                        opacity: analysisComplete && !active ? 0.15 : 1,
                      }}
                      transition={{ repeat: active ? Infinity : 0, duration: 2 }}
                    />
                  );
                })}

                {laidOut.map((node) => {
                  const state = nodeState(node.id);
                  const isRoot = state === 'root';
                  const isAffected = state === 'affected';
                  const baseColor =
                    node.status === 'critical' ? '#ef4444' : node.status === 'warning' ? '#f59e0b' : '#06b6d4';
                  const stroke = isRoot ? '#f59e0b' : isAffected ? '#ef4444' : analysisComplete ? '#3f3f46' : baseColor;
                  return (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                      <motion.rect
                        x="-7" y="-7" width="14" height="14"
                        fill="#09090b"
                        stroke={stroke}
                        strokeWidth={isRoot ? 2.5 : 1.5}
                        filter={isRoot ? 'url(#glow-amber)' : 'url(#glow-cyan)'}
                        animate={{ scale: isRoot ? [1, 1.25, 1] : 1 }}
                        transition={{ repeat: isRoot ? Infinity : 0, duration: 1.5 }}
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        transform="rotate(45)"
                      />
                      {isRoot && (
                        <circle r="34" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 4" className="animate-[spin_6s_linear_infinite] opacity-40" />
                      )}
                      <text
                        y="26" fontSize="13"
                        fill={isRoot ? '#fbbf24' : isAffected ? '#fca5a5' : '#a1a1aa'}
                        textAnchor="middle"
                        className="font-mono tracking-wide uppercase"
                      >
                        {node.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {analysisComplete && analysis && (
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950/90 py-2 px-4 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center gap-3 rounded">
                  <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-widest text-amber-500 font-bold">Root Node Isolate: {analysis.rootCause}</span>
               </div>
            )}
          </div>
        </div>

        {/* PANEL 3: AI INTELLIGENCE */}
        <div className="xl:col-span-3 h-[400px] lg:h-[500px] xl:min-h-[500px] bg-[#0d0d0f] border border-zinc-900 rounded flex flex-col overflow-hidden relative shrink-0">
           <div className="p-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
             <h2 className="font-mono text-sm md:text-base uppercase tracking-widest font-semibold text-zinc-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 md:w-5 md:h-5 text-teal-400" /> Synthesis
             </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {analysisComplete && analysis ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* RCA Banner */}
                <div>
                  <div className="text-xs md:text-sm font-mono text-zinc-500 mb-1.5 uppercase tracking-widest">Identified Root Cause</div>
                  <div className="p-3 bg-amber-500/10 border-l-4 border-amber-500">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-4 h-4 text-amber-500 md:w-5 md:h-5" />
                      <div className="text-sm md:text-base font-semibold text-zinc-100 uppercase tracking-widest">{analysis.rootCause}</div>
                    </div>
                    {analysis.rootCauseType && (
                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">{analysis.rootCauseType}</div>
                    )}
                    <div className="text-xs md:text-sm text-teal-400 font-mono flex gap-1 items-center mt-2">
                      <Fingerprint className="w-3 h-3 md:w-4 md:h-4" /> Confidence: {analysis.confidence}%
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded">
                  <div className="text-xs md:text-sm font-mono text-zinc-500 mb-2.5 uppercase tracking-wide">LLM Explanation</div>
                  <p className="text-xs md:text-sm text-zinc-300 font-mono leading-relaxed">{analysis.explanation}</p>
                </div>

                <div>
                  <div className="text-xs md:text-sm font-mono text-zinc-500 mb-3 uppercase tracking-wide">Blast Radius (Affected)</div>
                  <div className="flex flex-col gap-2">
                    {analysis.affectedServices.map((s) => (
                      <span key={s} className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs md:text-sm font-mono">Service::{s}</span>
                    ))}
                    {analysis.affectedTeams.map((t) => (
                      <span key={t} className="px-2.5 py-1.5 bg-zinc-800 text-zinc-400 text-xs md:text-sm font-mono">Team::{t}</span>
                    ))}
                  </div>
                </div>

                {analysis.historicalMatch && (
                  <div className="pt-5 border-t border-zinc-800">
                    <div className="text-xs md:text-sm font-mono text-zinc-500 mb-3 uppercase tracking-wide">Historical Match</div>
                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded">
                      <div className="text-xs md:text-sm text-cyan-400 font-mono mb-2">{analysis.historicalMatch.incidentId} • {analysis.historicalMatch.date}</div>
                      <div className="text-sm md:text-base text-zinc-300 mb-3">{analysis.historicalMatch.summary}</div>
                      <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-500 font-mono">
                        <User className="w-4 h-4 md:w-5 md:h-5" /> Resolver: <span className="text-zinc-300">{analysis.historicalMatch.resolver} ({analysis.historicalMatch.team})</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 font-mono text-xs md:text-sm uppercase tracking-widest gap-3 text-center px-4">
                {busy ? (
                  <>
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    {phase === 'simulating' ? 'Ingesting incident stream...' : 'Correlating root cause...'}
                  </>
                ) : (
                  <>
                    <Brain className="w-8 h-8 opacity-20 md:w-10 md:h-10" />
                    Awaiting incident analysis
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
