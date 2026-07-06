import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Database, KeyRound, MessageSquare, CreditCard, Box, UserPlus, Globe, Building2, Server, ShieldCheck, Network as NetworkIcon, Zap, X } from 'lucide-react';
import type { GraphNode, GraphResponse, HealthStatus, ImpactResponse } from '../types';
import { getGraph, getImpact, ApiClientError } from '../api/client';
import { LoadingState, ErrorState, EmptyState } from './States';

function iconFor(node: GraphNode) {
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
  const n = node.name.toLowerCase();
  if (node.type === 'Database') return 'Storage';
  if (n.includes('gateway')) return 'Ingress';
  if (n.includes('auth') || n.includes('login') || n.includes('password') || n.includes('session')) return 'Auth';
  if (n.includes('payment') || n.includes('billing')) return 'Finance';
  if (n.includes('notification')) return 'Comms';
  if (n.includes('registration') || n.includes('user') || n.includes('team')) return 'Core';
  return 'Service';
}

export default function Architecture() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);

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
    load();
  }, []);

  const handleNodeClick = async (node: GraphNode) => {
    if (selectedNodeId === node.id) {
      // Clicking the already-selected node clears the blast-radius view.
      setSelectedNodeId(null);
      setImpact(null);
      setImpactError(null);
      return;
    }
    setSelectedNodeId(node.id);
    setImpact(null);
    setImpactError(null);
    setImpactLoading(true);
    try {
      setImpact(await getImpact(node.id));
    } catch (err) {
      setImpactError(err instanceof ApiClientError ? err.message : 'Could not compute blast radius for this node.');
    } finally {
      setImpactLoading(false);
    }
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

            <div>
               <div className="text-sm md:text-base font-mono tracking-widest text-zinc-600 uppercase mb-5 flex items-center gap-2 border-b border-zinc-900 pb-3">
                 <Server className="w-5 h-5" /> Internal Microservices
               </div>
               <p className="text-xs md:text-sm text-zinc-600 font-mono -mt-3 mb-4">Click any node to trace its blast radius.</p>
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
                      className={`p-4 rounded border relative overflow-hidden flex flex-col justify-between min-h-[140px] cursor-pointer transition-shadow ${
                        status === 'critical' ? 'bg-red-500/5 border-red-500/30' :
                        status === 'warning' ? 'bg-amber-500/5 border-amber-500/30' :
                        'bg-[#0d0d0f] border-zinc-900'
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