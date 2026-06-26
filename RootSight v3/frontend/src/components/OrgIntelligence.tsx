import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, AlertTriangle, Users, Wrench, ChevronRight, GitBranch, Lightbulb } from 'lucide-react';
import type { OrgIntelligenceResponse } from '../types';
import { getOrgIntelligence, ApiClientError } from '../api/client';
import { LoadingState, ErrorState } from './States';

const RESPONDER_BADGE: Record<string, { label: string; dot: string; text: string; wrap: string }> = {
  'on-call': { label: 'On Call', dot: 'bg-amber-500 animate-pulse', text: 'text-amber-500', wrap: 'bg-amber-500/10 border-amber-500/20' },
  'in-incident': { label: 'In Incident', dot: 'bg-red-500 animate-pulse', text: 'text-red-500', wrap: 'bg-red-500/10 border-red-500/20' },
  idle: { label: 'Idle', dot: 'bg-zinc-600', text: 'text-zinc-500', wrap: 'bg-zinc-800/50 border-zinc-700/50' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '');
}

export default function OrgIntelligence() {
  const [data, setData] = useState<OrgIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getOrgIntelligence());
    } catch (err) {
      if (err instanceof ApiClientError) setError({ message: err.message, code: err.code });
      else setError({ message: 'Failed to load organizational intelligence.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="flex-1 w-full bg-zinc-950"><LoadingState label="Analyzing structural risk..." /></div>;
  }
  if (error || !data) {
    return <div className="flex-1 w-full bg-zinc-950"><ErrorState message={error?.message || 'No data.'} code={error?.code} onRetry={load} /></div>;
  }

  const maxRefs = Math.max(1, ...data.keyResponders.map((r) => r.references));

  return (
    <div className="flex-1 w-full pt-10 px-4 md:px-8 pb-8 overflow-y-auto bg-zinc-950">
      <div className="w-full space-y-6">

        <header className="mb-6">
          <h1 className="font-display font-bold text-white mb-1 uppercase tracking-tight text-3xl md:text-4xl lg:text-5xl">Systematic Risk Mapping</h1>
          <p className="font-mono text-zinc-400 text-sm md:text-base">Identify structural vulnerabilities masquerading as local failures.</p>
        </header>

        {/* SPOF Alert */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f0404] border border-red-500/30 rounded p-6 relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-red-500/10 to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-start gap-5">
            <div className="w-14 h-14 bg-red-500/10 rounded flex items-center justify-center shrink-0 border border-red-500/30">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-red-500/20 text-red-500 text-xs md:text-sm lg:text-base font-mono tracking-widest uppercase font-bold mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> S.P.O.F Detected
              </div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-display font-bold text-zinc-100 mb-2">Vendor Risk: {data.spof.name}</h2>
              <p className="text-zinc-400 text-sm md:text-base lg:text-lg max-w-3xl leading-relaxed mb-5 font-mono">
                 {data.spof.description}
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                {data.spof.dependentServices.map((s) => (
                  <span key={s} className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs md:text-sm font-mono">{s}</span>
                ))}
              </div>
              <div className="flex gap-3">
                <button className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-zinc-950 font-bold uppercase tracking-wider text-xs md:text-sm lg:text-base transition-colors rounded">
                  Initiate Fallback Drafting
                </button>
                <button className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-wider text-xs md:text-sm lg:text-base border border-zinc-800 transition-colors rounded">
                  Isolate Dependencies
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Card 1: Ownership Burden */}
          <div className="bg-[#0d0d0f] border border-zinc-900 rounded p-5">
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-900 pb-3">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-cyan-500" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-zinc-300 uppercase tracking-widest">Ownership Burden</h3>
            </div>
            <div className="space-y-5">
              {data.ownershipBurden.map((team) => {
                const volatile = team.loadStatus === 'volatile';
                return (
                  <div key={team.team} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs md:text-sm font-mono">
                      <span className="text-zinc-300">{team.team}</span>
                      <span className={volatile ? 'text-red-400' : 'text-teal-400'}>
                        {team.loadPercent}% {volatile ? 'Volatile Load' : 'Stable Load'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div className={`h-full ${volatile ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${team.loadPercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 2: Key Responders */}
          <div className="bg-[#0d0d0f] border border-zinc-900 rounded p-5">
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-900 pb-3">
              <Wrench className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-zinc-300 uppercase tracking-widest">Key Responders</h3>
            </div>
            <div className="space-y-4">
              {data.keyResponders.map((r) => {
                const badge = RESPONDER_BADGE[r.status] || RESPONDER_BADGE.idle;
                return (
                  <div key={r.id} className="group flex items-center justify-between p-2 hover:bg-zinc-900 rounded transition-colors cursor-pointer border border-transparent hover:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded bg-zinc-800 flex items-center justify-center text-xs md:text-sm font-bold text-zinc-400 font-mono uppercase">
                        {initials(r.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <div className="text-sm md:text-base font-semibold text-zinc-200">{r.name}</div>
                           <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm border ${badge.wrap}`}>
                              <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${badge.dot}`}></span>
                              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${badge.text}`}>{badge.label}</span>
                           </div>
                        </div>
                        <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-wider mt-0.5">{r.team}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs md:text-sm font-mono bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded border border-purple-500/20">
                        {r.references} Refs
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Vendor Reliability */}
          <div className="bg-[#0d0d0f] border border-zinc-900 rounded p-5">
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-900 pb-3">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-zinc-300 uppercase tracking-widest">Vendor Reliability</h3>
            </div>
            <div className="space-y-4">
               {data.vendorReliability.map((v) => {
                 const degraded = v.status === 'degraded';
                 return (
                   <div key={v.id} className={`flex flex-col gap-1 p-2 rounded ${degraded ? 'bg-red-500/5 border border-red-500/10' : ''}`}>
                     <div className="flex justify-between items-center">
                       <span className={`text-sm md:text-base ${degraded ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}`}>{v.name}</span>
                       <span className={`font-mono text-xs md:text-sm flex items-center gap-2 ${degraded ? 'text-red-400' : 'text-emerald-400'}`}>
                          {degraded && <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />} {v.uptime}% ({degraded ? 'Degraded' : 'Stable'})
                       </span>
                     </div>
                     <div className="mt-1 flex items-center gap-2 text-xs md:text-sm font-mono">
                       <span className="text-zinc-500 uppercase tracking-widest">Downtime Duration:</span>
                       <span className={`font-bold px-1.5 py-0.5 rounded border ${degraded ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-zinc-400 bg-zinc-800/50 border-zinc-700/50'}`}>{v.downtimeMinutes} mins</span>
                     </div>
                   </div>
                 );
               })}
            </div>
          </div>

        </div>

        {/* Critical Dependency Chains */}
        {data.criticalChains?.length > 0 && (
          <div className="bg-[#0d0d0f] border border-zinc-900 rounded p-5">
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-900 pb-3">
              <GitBranch className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-zinc-300 uppercase tracking-widest">Critical Dependency Chains</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.criticalChains.map((chain) => (
                <div key={chain.id} className="p-4 rounded bg-zinc-950 border border-zinc-900">
                  <div className="flex items-center flex-wrap gap-2 mb-3 font-mono text-xs md:text-sm">
                    {chain.path.map((node, idx) => (
                      <span key={idx} className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">{node}</span>
                        {idx < chain.path.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs md:text-sm text-zinc-500 font-mono leading-relaxed">{chain.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations?.length > 0 && (
          <div className="bg-cyan-500/5 border border-cyan-500/10 rounded p-5">
            <div className="flex items-center gap-3 mb-4">
              <Lightbulb className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-cyan-300 uppercase tracking-widest">AI Recommendations</h3>
            </div>
            <div className="space-y-3">
              {data.recommendations.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 text-xs md:text-sm font-mono text-cyan-400 leading-relaxed">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 uppercase text-[10px] tracking-widest shrink-0">{rec.priority}</span>
                  <span className="text-zinc-300">{rec.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
