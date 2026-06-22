import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Play, Brain, Activity, Zap, Network, User, Cpu, FileWarning, Fingerprint } from 'lucide-react';
import type { IncidentEvent } from '../types';

export default function Dashboard() {
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [incidentActive, setIncidentActive] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const MOCK_EVENTS = [
    "Cannot login: Invalid token response",
    "OTP not arriving - timeout exceeded",
    "Password reset broken (502 Bad Gateway)",
    "OAuth timeout from upstream provider"
  ];

  const NODES = [
    { id: 'gate', label: 'API Gateway', type: 'service', x: 200, y: 150 },
    { id: 'login', label: 'Login Svc', type: 'service', x: 100, y: 250 },
    { id: 'reg', label: 'Registration', type: 'service', x: 200, y: 250 },
    { id: 'pass', label: 'Password Reset', type: 'service', x: 300, y: 250 },
    { id: 'google', label: 'Google OAuth', type: 'vendor', x: 150, y: 350 },
    { id: 'twilio', label: 'Twilio', type: 'vendor', x: 300, y: 350 },
  ];

  const EDGES = [
    { source: 'gate', target: 'login' },
    { source: 'gate', target: 'reg' },
    { source: 'gate', target: 'pass' },
    { source: 'login', target: 'google' },
    { source: 'reg', target: 'google' },
    { source: 'pass', target: 'twilio' },
  ];

  const injectIncident = () => {
    if (incidentActive) return;
    setEvents([]);
    setIncidentActive(true);
    setAnalysisComplete(false);
    
    let delay = 0;
    MOCK_EVENTS.forEach((msg, idx) => {
      setTimeout(() => {
        setEvents(prev => [{
          id: `evt-${Date.now()}-${idx}`,
          timestamp: new Date().toISOString().split('T')[1].slice(0,8),
          message: msg,
          type: 'error'
        }, ...prev]);
        
        if (idx === MOCK_EVENTS.length - 1) {
          setTimeout(() => setAnalysisComplete(true), 1500);
        }
      }, delay);
      delay += 800;
    });
  };

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
        <div className="xl:col-span-3 h-[300px] lg:h-[400px] xl:min-h-[500px] flex flex-col bg-[#0d0d0f] border border-zinc-900 rounded relative overflow-hidden shrink-0">
          <div className="p-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
            <h2 className="font-mono text-sm uppercase tracking-widest font-semibold text-zinc-300 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" /> Pipeline
            </h2>
            <button 
              onClick={injectIncident}
              disabled={incidentActive}
              className="px-4 py-2 text-xs uppercase font-bold tracking-wider rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Execute Test
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs md:text-sm">
            <AnimatePresence>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded bg-red-500/5 border-l-2 border-red-500 text-zinc-300"
                >
                  <div className="text-red-400 text-xs gap-1 opacity-80 mb-1.5">{event.timestamp} [ERR_SEQ]</div>
                  <div>{event.message}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {!incidentActive && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                <FileWarning className="w-6 h-6 opacity-50" />
                <span>Awaiting Event Stream...</span>
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
              <div className="text-xs md:text-sm text-zinc-300">Authentication Incident Cluster Extracted</div>
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
            {/* Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:2rem_2rem] border-zinc-800"></div>

            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <filter id="glow-amber">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="glow-cyan">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {EDGES.map((edge, i) => {
                const source = NODES.find(n => n.id === edge.source)!;
                const target = NODES.find(n => n.id === edge.target)!;
                const isAffected = analysisComplete && (edge.target === 'google' || edge.source === 'google' || edge.source === 'login' || edge.source === 'reg');
                
                return (
                  <motion.line
                    key={i}
                    x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                    stroke={isAffected ? '#f59e0b' : '#27272a'}
                    strokeWidth={isAffected ? 2 : 1}
                    animate={{ 
                      stroke: isAffected ? ['#f59e0b', '#fbbf24', '#f59e0b'] : '#27272a',
                      opacity: analysisComplete && !isAffected ? 0.2 : 1
                    }}
                    transition={{ repeat: isAffected ? Infinity : 0, duration: 2 }}
                    className="transition-colors duration-1000"
                  />
                );
              })}
              
              {NODES.map((node, i) => {
                const isRoot = analysisComplete && node.id === 'google';
                const isAffected = analysisComplete && ['gate', 'login', 'reg'].includes(node.id);
                
                return (
                  <g key={i} transform={`translate(${node.x}, ${node.y})`}>
                    {/* Node Core */}
                    <motion.rect 
                      x="-6" y="-6" width="12" height="12"
                      fill="#09090b"
                      stroke={isRoot ? '#f59e0b' : isAffected ? '#ef4444' : '#06b6d4'}
                      strokeWidth={isRoot ? 2 : 1.5}
                      filter={isRoot ? 'url(#glow-amber)' : 'url(#glow-cyan)'}
                      animate={{ 
                        scale: isRoot ? [1, 1.2, 1] : 1,
                      }}
                      rotate="45"
                      transition={{ repeat: isRoot ? Infinity : 0, duration: 1.5 }}
                    />
                    {isRoot && (
                      <circle r="32" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 4" className="animate-[spin_6s_linear_infinite] opacity-40" />
                    )}
                    <text y="24" fontSize="10" fill={isRoot ? '#fbbf24' : '#a1a1aa'} textAnchor="middle" className="font-mono tracking-widest uppercase transition-colors duration-1000">
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            
            {analysisComplete && (
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950/90 py-2 px-4 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center gap-3 rounded">
                  <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-widest text-amber-500 font-bold">Root Node Isolate: Google OAuth</span>
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
          
          <div className="flex-1 overflow-y-auto p-4">
            {analysisComplete ? (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* RCA Banner */}
                <div>
                  <div className="text-xs md:text-sm font-mono text-zinc-500 mb-1.5 uppercase tracking-widest">Identified Root Cause</div>
                  <div className="p-3 bg-amber-500/10 border-l-4 border-amber-500">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldAlert className="w-4 h-4 text-amber-500 md:w-5 md:h-5" />
                      <div className="text-sm md:text-base font-semibold text-zinc-100 uppercase tracking-widest">Google OAuth Outage</div>
                    </div>
                    <div className="text-xs md:text-sm text-teal-400 font-mono flex gap-1 items-center mt-2">
                      <Fingerprint className="w-3 h-3 md:w-4 md:h-4" /> Confidence: 92.4%
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded">
                  <div className="text-xs md:text-sm font-mono text-zinc-500 mb-2.5 uppercase tracking-wide">LLM Explanation</div>
                  <p className="text-xs md:text-sm lg:text-base text-zinc-300 font-mono leading-relaxed">
                     &gt; Upstream Google OAuth API returning 504 Gateway Timeouts.<br/><br/>
                     &gt; Cascading failure cascading to [Login] and [Registration] via token validation failures.
                  </p>
                </div>

                <div>
                  <div className="text-xs md:text-sm font-mono text-zinc-500 mb-3 uppercase tracking-wide">Blast Radius (Affected)</div>
                  <div className="flex flex-col gap-2">
                    <span className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs md:text-sm font-mono">Service::Login</span>
                    <span className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs md:text-sm font-mono">Service::Registration</span>
                    <span className="px-2.5 py-1.5 bg-zinc-800 text-zinc-400 text-xs md:text-sm font-mono">Team::Alpha</span>
                    <span className="px-2.5 py-1.5 bg-zinc-800 text-zinc-400 text-xs md:text-sm font-mono">Team::Beta</span>
                  </div>
                </div>

                <div className="pt-5 border-t border-zinc-800">
                  <div className="text-xs md:text-sm font-mono text-zinc-500 mb-3 uppercase tracking-wide">Historical Match</div>
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded">
                    <div className="text-xs md:text-sm text-cyan-400 font-mono mb-2">INC-42 • 2025-01-12</div>
                    <div className="text-sm md:text-base text-zinc-300 mb-3">OAuth credential latency.</div>
                    <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-500 font-mono">
                      <User className="w-4 h-4 md:w-5 md:h-5" /> Resolver: <span className="text-zinc-300">Rahul (Team Alpha)</span>
                    </div>
                  </div>
                </div>

              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 font-mono text-xs md:text-sm uppercase tracking-widest gap-3">
                <Brain className="w-8 h-8 opacity-20 md:w-10 md:h-10" />
                Data required...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
