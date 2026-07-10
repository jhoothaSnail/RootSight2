import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Database, KeyRound, MessageSquare, CreditCard, Box, UserPlus, Globe, Building2, Server, ShieldCheck, Network as NetworkIcon, Zap, X, Info, Users, GitBranch, AlertTriangle } from 'lucide-react';
import type { GraphNode, HealthStatus, ImpactResponse, NodeInspectorNode } from '../types';
import { getGraph, getImpact, getNodeInspector, ApiClientError } from '../api/client';
import { LoadingState, ErrorState, EmptyState } from './States';
import { useAnalysis } from '../context/AnalysisContext';

// Maps a backend-inferred functional category (see enrichCategories in
// backend/server.js) to the short badge word already used by this UI, and to
// one of the icons already imported here. Falls back to the old name-based
// heuristics when a node has no category yet (e.g. data ingested before this
// change), so nothing regresses for existing graphs.
const CATEGORY_DISPLAY: Record<string, { label: string; icon: 'database' | 'vendor' | 'gateway' | 'auth' | 'user' | 'payment' | 'comms' | 'security' | 'box' }> = {
  'Authentication & Identity': { label: 'Auth', icon: 'auth' },
  'Authentication & Identity Provider': { label: 'Auth', icon: 'auth' },
  'Payment & Billing': { label: 'Finance', icon: 'payment' },
  'Payment Processor': { label: 'Finance', icon: 'payment' },
  'Messaging & Notifications': { label: 'Comms', icon: 'comms' },
  'Communications Provider': { label: 'Comms', icon: 'comms' },
  'Monitoring & Observability': { label: 'Monitoring', icon: 'security' },
  'Logging': { label: 'Logs', icon: 'security' },
  'Search & Discovery': { label: 'Search', icon: 'box' },
  'Search Index': { label: 'Storage', icon: 'database' },
  'User & Account Management': { label: 'Core', icon: 'user' },
  'Background Processing': { label: 'Jobs', icon: 'box' },
  'Analytics & Reporting': { label: 'Analytics', icon: 'box' },
  'Analytics Provider': { label: 'Analytics', icon: 'box' },
  'Core Business Logic': { label: 'Service', icon: 'box' },
  'API Gateway': { label: 'Ingress', icon: 'gateway' },
  'Cloud Infrastructure': { label: 'Infra', icon: 'vendor' },
  'Storage & CDN': { label: 'Storage', icon: 'vendor' },
  'Security & Compliance': { label: 'Security', icon: 'security' },
  'Third-Party Integration': { label: 'Vendor', icon: 'vendor' },
  'Relational Database': { label: 'Storage', icon: 'database' },
  'Document / NoSQL Database': { label: 'Storage', icon: 'database' },
  'Cache': { label: 'Storage', icon: 'database' },
  'Message Queue / Broker': { label: 'Storage', icon: 'database' },
  'Object Storage': { label: 'Storage', icon: 'database' },
  'Data Warehouse': { label: 'Storage', icon: 'database' },
  'Database': { label: 'Storage', icon: 'database' },
};

function categoryMeta(node: GraphNode) {
  if (node.category && CATEGORY_DISPLAY[node.category]) return CATEGORY_DISPLAY[node.category];
  return null;
}

function iconFor(node: GraphNode) {
  const meta = categoryMeta(node);
  if (meta) {
    switch (meta.icon) {
      case 'database': return <Database />;
      case 'vendor': return <Globe />;
      case 'gateway': return <NetworkIcon />;
      case 'auth': return <KeyRound />;
      case 'user': return <UserPlus />;
      case 'payment': return <CreditCard />;
      case 'comms': return <MessageSquare />;
      case 'security': return <ShieldCheck />;
      default: return <Box />;
    }
  }
  // Fallback for nodes without a resolved category yet.
  const n = node.name.toLowerCase();
  if (node.type === 'Database') return <Database />;
  if (node.type === 'Vendor') return <Globe />;
  if (n.includes('gateway')) return <NetworkIcon />;
  if (n.includes('login') || n.includes('auth') || n.includes('password') || n.includes('session')) return <KeyRound />;
  if (n.includes('registration') || n.includes('user')) return <UserPlus />;
  if (n.includes('payment') || n.includes('billing')) return <CreditCard />;
  if (n.includes('notification')) return <MessageSquare />;
  if (n.includes('rate')) return <ShieldCheck />;
  return <Box />;
}

const STATUS_META: Record<HealthStatus, { label: string; metric: string }> = {
  critical: { label: 'Critical', metric: 'Degraded' },
  warning: { label: 'Warning', metric: 'Elevated Latency' },
  healthy: { label: 'Healthy', metric: 'Nominal' },
};

const SEVERITY_META: Record<ImpactResponse['severity'], { label: string; text: string; border: string; bg: string }> = {
  critical: { label: 'Critical', text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
  high: { label: 'High', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  medium: { label: 'Medium', text: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/5' },
  low: { label: 'Low', text: 'text-zinc-400', border: 'border-zinc-800', bg: 'bg-[#0d0d0f]' },
};

function domainFor(node: GraphNode): string {
  // Prefer the backend-inferred functional category (dynamic, works for any
  // company/technology — see enrichCategories in backend/server.js). Only
  // fall back to the old name-based guess if a node has no category, e.g.
  // graphs stored before this change.
  const meta = categoryMeta(node);
  if (meta) return meta.label;

  const n = node.name.toLowerCase();
  if (node.type === 'Database') return 'Storage';
  if (n.includes('gateway')) return 'Ingress';
  if (n.includes('auth') || n.includes('login') || n.includes('password') || n.includes('session')) return 'Auth';
  if (n.includes('payment') || n.includes('billing')) return 'Finance';
  if (n.includes('notification')) return 'Comms';
  if (n.includes('registration') || n.includes('user') || n.includes('team')) return 'Core';
  return 'Service';
}

// Renders a comma-separated list of related nodes, or an honest "not
// available" / "none found" placeholder — never fake data. `emptyIsUnknown`
// distinguishes "we checked and there are none" (None Found) from "this
// wasn't present in the uploaded documents at all" (Not Available).
function RelatedList({ items }: { items: { id: string; name: string }[] }) {
  if (items.length === 0) {
    return <span className="text-zinc-600 italic">None found</span>;
  }
  return <span className="text-zinc-300">{items.map((n) => n.name).join(', ')}</span>;
}

function NodeInspectorPanel({
  loading,
  error,
  node,
  impact,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  node: NodeInspectorNode | null;
  impact: ImpactResponse | null;
  onClose: () => void;
}) {
  const status = (node?.status || 'healthy') as HealthStatus;
  const statusColor =
    status === 'critical' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
    status === 'warning' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
    'text-teal-400 border-teal-500/30 bg-teal-500/10';

  // Criticality is the same severity already computed by the existing
  // blast-radius feature (/api/impact) — reused here rather than
  // recomputed, so the two panels always agree.
  const criticality = impact ? SEVERITY_META[impact.severity] : null;

  return (
    <div className="rounded border border-zinc-900 bg-[#0d0d0f] p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-sm md:text-base font-mono tracking-widest uppercase text-zinc-400">
          <Info className="w-4 h-4 text-teal-400" /> Node Inspector
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Close node inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-xs md:text-sm font-mono text-zinc-500">Loading node details...</div>
      ) : error ? (
        <div className="text-xs md:text-sm font-mono text-red-400">{error}</div>
      ) : node ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-zinc-200 text-base md:text-lg">{node.name}</h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] md:text-xs font-mono uppercase tracking-widest font-bold border border-zinc-700 text-zinc-300 bg-zinc-800/50">
              {node.category || node.type}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] md:text-xs font-mono uppercase tracking-widest font-bold border ${statusColor}`}>
              {STATUS_META[status].label}
            </span>
          </div>

          <p className="text-xs md:text-sm text-zinc-400">
            {node.description || <span className="text-zinc-600 italic">Not Available</span>}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/50 text-xs md:text-sm font-mono">
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" /> Owner Team</span>
              <span className="text-zinc-300">{node.ownerTeam || <span className="text-zinc-600 italic">Not Available</span>}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Criticality Level</span>
              <span className={criticality ? criticality.text : 'text-zinc-600 italic'}>
                {criticality ? criticality.label : 'Not Available'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider flex items-center gap-1"><GitBranch className="w-3 h-3" /> Total Dependency Count</span>
              <span className="text-zinc-300">{node.totalDependencyCount}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3" /> Blast Radius</span>
              <span className="text-zinc-300">
                {impact ? `${impact.totalAffected} node${impact.totalAffected === 1 ? '' : 's'}` : <span className="text-zinc-600 italic">Not Available</span>}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Recent Incident Count</span>
              <span className="text-zinc-300">
                {node.recentIncidentCount === null ? <span className="text-zinc-600 italic">Not Available</span> : node.recentIncidentCount}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/50 text-xs md:text-sm font-mono">
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider">Direct Dependencies ({node.directDependencies.length})</span>
              <RelatedList items={node.directDependencies} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider">Downstream Dependent Services ({node.downstreamDependents.length})</span>
              <RelatedList items={node.downstreamDependents} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-500 uppercase tracking-wider">Related Vendor/Database</span>
              <RelatedList items={node.relatedVendorsAndDatabases} />
            </div>
          </div>

          <div className="rounded border border-zinc-800/70 bg-zinc-900/30 p-3 flex gap-2">
            <Zap className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] md:text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">AI Risk Summary</div>
              <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">{node.riskSummary}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function Architecture() {
  // graph is shared via AnalysisContext with Dashboard and Runbooks, so it
  // survives navigating away and back instead of being re-fetched every time
  // this view remounts. loading/error stay local since they only describe
  // this view's own fetch-in-flight UI, not something other views need.
  const { graph, setGraph } = useAnalysis();
  const [loading, setLoading] = useState(() => !graph);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);

  // Node Inspector — separate state from the blast-radius banner above, so
  // the existing blast-radius feature is never touched by this addition.
  const [nodeDetails, setNodeDetails] = useState<NodeInspectorNode | null>(null);
  const [nodeDetailsLoading, setNodeDetailsLoading] = useState(false);
  const [nodeDetailsError, setNodeDetailsError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setGraph(await getGraph());
    } catch (err) {
      if (err instanceof ApiClientError) setError({ message: err.message, code: err.code });
      else setError({ message: 'Failed to load the architecture map.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (graph) {
      // Already loaded (e.g. the Analysis Engine fetched it, or the user is
      // simply returning to this section) — reuse it instead of refetching.
      setLoading(false);
      return;
    }
    load();
    // Intentionally runs once per mount only — the guard above, not this
    // dependency array, decides whether a fetch actually happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNodeClick = async (node: GraphNode) => {
    if (selectedNodeId === node.id) {
      // Clicking the already-selected node clears the blast-radius view
      // and the Node Inspector together.
      setSelectedNodeId(null);
      setImpact(null);
      setImpactError(null);
      setNodeDetails(null);
      setNodeDetailsError(null);
      return;
    }
    setSelectedNodeId(node.id);
    setImpact(null);
    setImpactError(null);
    setImpactLoading(true);
    setNodeDetails(null);
    setNodeDetailsError(null);
    setNodeDetailsLoading(true);
    // Fetched independently/concurrently so the Node Inspector updates
    // immediately regardless of how long the blast-radius call takes, and a
    // failure in one panel never blocks the other.
    void (async () => {
      try {
        setImpact(await getImpact(node.id));
      } catch (err) {
        setImpactError(err instanceof ApiClientError ? err.message : 'Could not compute blast radius for this node.');
      } finally {
        setImpactLoading(false);
      }
    })();
    void (async () => {
      try {
        setNodeDetails((await getNodeInspector(node.id)).node);
      } catch (err) {
        setNodeDetailsError(err instanceof ApiClientError ? err.message : 'Could not load details for this node.');
      } finally {
        setNodeDetailsLoading(false);
      }
    })();
  };

  const affectedIdSet = useMemo(() => {
    if (!impact) return new Set<string>();
    return new Set([...impact.affectedServices, ...impact.affectedVendors].map((n) => n.id));
  }, [impact]);

  const { internal, vendors, vendorImpact } = useMemo(() => {
    if (!graph) return { internal: [] as GraphNode[], vendors: [] as GraphNode[], vendorImpact: new Map<string, number>() };
    const internalNodes = graph.nodes.filter((n) => n.type === 'Service' || n.type === 'Database');
    const vendorNodes = graph.nodes.filter((n) => n.type === 'Vendor');
    const impact = new Map<string, number>();
    for (const rel of graph.relationships) {
      if (rel.type === 'USES_VENDOR') impact.set(rel.target, (impact.get(rel.target) || 0) + 1);
    }
    return { internal: internalNodes, vendors: vendorNodes, vendorImpact: impact };
  }, [graph]);

  return (
    <div className="flex-1 w-full pt-10 px-4 md:px-8 pb-8 overflow-y-auto bg-zinc-950">
      <div className="w-full space-y-6">

        <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-zinc-100 mb-1 uppercase tracking-tight text-3xl md:text-4xl lg:text-5xl">Global Architecture Map</h1>
            <p className="font-mono text-zinc-400 text-sm md:text-base">Holistic bird's-eye view of microservice health and dependency states.</p>
          </div>
          <div className="flex gap-4 bg-[#0d0d0f] p-3 px-5 rounded border border-zinc-900">
             <div className="flex items-center gap-2 text-xs md:text-sm font-mono uppercase tracking-widest text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Healthy</div>
             <div className="flex items-center gap-2 text-xs md:text-sm font-mono uppercase tracking-widest text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Warning</div>
             <div className="flex items-center gap-2 text-xs md:text-sm font-mono uppercase tracking-widest text-zinc-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span> Critical</div>
          </div>
        </header>

        {loading ? (
          <div className="h-[50vh]"><LoadingState label="Loading architecture map..." /></div>
        ) : error ? (
          <div className="h-[50vh]"><ErrorState message={error.message} code={error.code} onRetry={load} /></div>
        ) : !graph || graph.nodes.length === 0 ? (
          <div className="h-[50vh]"><EmptyState label="No architecture ingested yet." /></div>
        ) : (
          <>
            {selectedNodeId && (
              <div className={`rounded border p-4 flex flex-col gap-3 ${
                impact ? `${SEVERITY_META[impact.severity].bg} ${SEVERITY_META[impact.severity].border}` : 'bg-[#0d0d0f] border-zinc-900'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm md:text-base font-mono tracking-widest uppercase text-zinc-400">
                    <Zap className="w-4 h-4 text-teal-400" /> What Breaks If This Fails?
                  </div>
                  <button
                    onClick={() => { setSelectedNodeId(null); setImpact(null); setImpactError(null); }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label="Close blast radius panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {impactLoading ? (
                  <div className="text-xs md:text-sm font-mono text-zinc-500">Tracing dependency graph...</div>
                ) : impactError ? (
                  <div className="text-xs md:text-sm font-mono text-red-400">{impactError}</div>
                ) : impact ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-zinc-200 text-base md:text-lg">{impact.nodeName}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] md:text-xs font-mono uppercase tracking-widest font-bold border ${SEVERITY_META[impact.severity].border} ${SEVERITY_META[impact.severity].text}`}>
                        {SEVERITY_META[impact.severity].label} Blast Radius
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-zinc-400">{impact.description}</p>
                    {impact.totalAffected > 0 && (
                      <div className="flex flex-wrap gap-4 pt-2 border-t border-zinc-800/50 text-xs md:text-sm font-mono">
                        {impact.affectedServices.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 uppercase tracking-wider">Services ({impact.affectedServices.length})</span>
                            <span className="text-zinc-300">{impact.affectedServices.map((n) => n.name).join(', ')}</span>
                          </div>
                        )}
                        {impact.affectedTeams.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 uppercase tracking-wider">Teams ({impact.affectedTeams.length})</span>
                            <span className="text-zinc-300">{impact.affectedTeams.map((n) => n.name).join(', ')}</span>
                          </div>
                        )}
                        {impact.affectedVendors.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-zinc-500 uppercase tracking-wider">Vendors ({impact.affectedVendors.length})</span>
                            <span className="text-zinc-300">{impact.affectedVendors.map((n) => n.name).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {selectedNodeId && (
              <NodeInspectorPanel
                loading={nodeDetailsLoading}
                error={nodeDetailsError}
                node={nodeDetails}
                impact={impact}
                onClose={() => {
                  setSelectedNodeId(null);
                  setImpact(null);
                  setImpactError(null);
                  setNodeDetails(null);
                  setNodeDetailsError(null);
                }}
              />
            )}

            <div>
               <div className="text-sm md:text-base font-mono tracking-widest text-zinc-600 uppercase mb-5 flex items-center gap-2 border-b border-zinc-900 pb-3">
                 <Server className="w-5 h-5" /> Internal Microservices
               </div>
               <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded border border-teal-500/30 bg-teal-500/10">
                 <Info className="w-5 h-5 text-teal-400 shrink-0" />
                 <p className="text-sm md:text-base text-zinc-200 font-medium leading-snug">
                   Click any node below to inspect its dependencies, blast radius, and AI insights.
                 </p>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {internal.map((comp, i) => {
                  const status = (comp.status || 'healthy') as HealthStatus;
                  const meta = STATUS_META[status];
                  return (
                    <motion.div
                      key={comp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleNodeClick(comp)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNodeClick(comp); }}
                      className={`p-4 rounded border relative overflow-hidden flex flex-col justify-between min-h-[140px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${
                        status === 'critical' ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50' :
                        status === 'warning' ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50' :
                        'bg-[#0d0d0f] border-zinc-900 hover:border-zinc-700'
                      } ${
                        selectedNodeId === comp.id ? 'ring-2 ring-teal-400' :
                        affectedIdSet.has(comp.id) ? 'ring-2 ring-amber-400/70' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded ${
                          status === 'critical' ? 'bg-red-500/20 text-red-500' :
                          status === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                          'bg-teal-500/10 text-teal-400'
                        }`}>
                          {iconFor(comp)}
                        </div>
                        <div className="text-xs md:text-sm uppercase font-mono tracking-widest font-bold text-zinc-600">
                          {domainFor(comp)}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-200 text-base md:text-lg mb-1.5">{comp.name}</h3>
                        <div className={`text-xs md:text-sm font-mono uppercase tracking-wider ${
                          status === 'critical' ? 'text-red-400' :
                          status === 'warning' ? 'text-amber-500' :
                          'text-teal-500'
                        }`}>
                          {meta.metric}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="pt-6">
               <div className="text-sm md:text-base lg:text-lg font-mono tracking-widest text-zinc-600 uppercase mb-5 flex items-center gap-2 border-b border-zinc-900 pb-3">
                 <Building2 className="w-5 h-5" /> External Vendorships
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {vendors.map((vendor) => {
                    const status = (vendor.status || 'healthy') as HealthStatus;
                    const affected = vendorImpact.get(vendor.id) || 0;
                    const isCritical = status === 'critical';
                    return (
                      <div
                        key={vendor.id}
                        onClick={() => handleNodeClick(vendor)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNodeClick(vendor); }}
                        className={`p-4 rounded border flex flex-col justify-between gap-4 cursor-pointer transition-shadow ${
                          isCritical ? 'bg-red-500/5 border-red-500/30' :
                          status === 'warning' ? 'bg-amber-500/5 border-amber-500/30' :
                          'bg-[#0d0d0f] border-zinc-900'
                        } ${
                          selectedNodeId === vendor.id ? 'ring-2 ring-teal-400' :
                          affectedIdSet.has(vendor.id) ? 'ring-2 ring-amber-400/70' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-sm md:text-base lg:text-lg font-semibold text-zinc-200">{vendor.name}</div>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] md:text-xs lg:text-sm font-mono uppercase tracking-widest font-bold ${
                                isCritical ? 'bg-red-500/20 border border-red-500/30 text-red-500 animate-pulse' :
                                status === 'warning' ? 'bg-amber-500/20 border border-amber-500/30 text-amber-500' :
                                'bg-teal-500/10 border border-teal-500/20 text-teal-500'
                              }`}>{STATUS_META[status].label}</span>
                            </div>
                            <div className={`text-xs md:text-sm lg:text-base font-mono uppercase tracking-widest ${
                              isCritical ? 'text-red-400' : status === 'warning' ? 'text-amber-500' : 'text-teal-500'
                            }`}>
                              {isCritical ? 'Degraded • 504 Timeout' : status === 'warning' ? 'Intermittent' : 'Stable Response'}
                            </div>
                          </div>
                          <Globe className={`w-6 h-6 md:w-8 md:h-8 ${isCritical ? 'text-red-500/50' : 'text-zinc-700'}`} />
                        </div>
                        <div className={`flex items-center gap-6 text-xs md:text-sm lg:text-base font-mono border-t pt-3 ${isCritical ? 'border-red-500/10' : 'border-zinc-800/50'}`}>
                           <div className="flex flex-col gap-0.5">
                             <span className="text-zinc-500 uppercase tracking-wider">Dependent Services</span>
                             <span className={`font-bold text-xs md:text-sm lg:text-base ${isCritical ? 'text-zinc-200' : 'text-zinc-400'}`}>{affected}</span>
                           </div>
                           <div className="flex flex-col gap-0.5">
                             <span className="text-zinc-500 uppercase tracking-wider">Status</span>
                             <span className={`font-bold text-xs md:text-sm lg:text-base ${isCritical ? 'text-red-400' : 'text-zinc-400'}`}>{STATUS_META[status].label}</span>
                           </div>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}