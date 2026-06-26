import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Database, KeyRound, MessageSquare, CreditCard, Box, UserPlus, Globe, Building2, Server, ShieldCheck, Network as NetworkIcon } from 'lucide-react';
import type { GraphNode, GraphResponse, HealthStatus } from '../types';
import { getGraph, ApiClientError } from '../api/client';
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
            <div>
               <div className="text-sm md:text-base font-mono tracking-widest text-zinc-600 uppercase mb-5 flex items-center gap-2 border-b border-zinc-900 pb-3">
                 <Server className="w-5 h-5" /> Internal Microservices
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
                      className={`p-4 rounded border relative overflow-hidden flex flex-col justify-between min-h-[140px] ${
                        status === 'critical' ? 'bg-red-500/5 border-red-500/30' :
                        status === 'warning' ? 'bg-amber-500/5 border-amber-500/30' :
                        'bg-[#0d0d0f] border-zinc-900'
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
                        className={`p-4 rounded border flex flex-col justify-between gap-4 ${
                          isCritical ? 'bg-red-500/5 border-red-500/30' :
                          status === 'warning' ? 'bg-amber-500/5 border-amber-500/30' :
                          'bg-[#0d0d0f] border-zinc-900'
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
