import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Activity, Code2, Network, TerminalSquare, Database, ShieldAlert, Server } from 'lucide-react';
import { Logo } from './Logo';
import IntelligenceWorkspace from './IntelligenceWorkspace';

interface HomeProps {
  onNavigate: (view: 'dashboard') => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const [isWorkspaceActive, setIsWorkspaceActive] = useState(false);
  const [confidence, setConfidence] = useState(91);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  useEffect(() => {
    const analysisTimer = setTimeout(() => {
      setHasAnalyzed(true);
    }, 2000);
    return () => clearTimeout(analysisTimer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setConfidence((prev) => {
        let modifier = Math.floor(Math.random() * 5) - 2;
        let next = prev + modifier;
        if (next > 99) next = 99;
        if (next < 85) next = 85;
        return next;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const handleInitialize = () => {
    setIsWorkspaceActive(true);
  };

  return (
    <div className="flex-1 w-full flex flex-col relative overflow-y-auto overflow-x-hidden bg-zinc-950 px-6 sm:px-12 py-8 selection:bg-amber-500/30">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_20%,transparent_100%)] opacity-20"></div>
        
        {/* Deep Red Glowing Orb */}
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3] }} 
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(220, 38, 38, 0.15) 0%, rgba(220, 38, 38, 0) 70%)', transformOrigin: 'center center' }}
        />
        {/* Amber Glowing Orb */}
        <motion.div 
          animate={{ rotate: -360, scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }} 
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] left-[-20%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0) 70%)', transformOrigin: '60% 40%' }}
        />
        {/* Teal Glowing Orb */}
        <motion.div 
          animate={{ rotate: 360, scale: [1.1, 1, 1.1], opacity: [0.15, 0.2, 0.15] }} 
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[10%] w-[90vw] h-[90vw] max-w-[1200px] max-h-[1200px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0) 70%)', transformOrigin: '30% 70%' }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between w-full px-8 lg:px-16 pt-8">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8 drop-shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
          <span className="font-display font-semibold text-xl tracking-wide text-zinc-100 uppercase">RootSight</span>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-zinc-800 bg-zinc-900/50 rounded text-zinc-400 text-xs font-mono tracking-widest uppercase backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
          Platform Status: Nominal
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center w-full px-8 lg:px-16 py-12">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 w-full h-full pb-8">
          {/* Left Column: Typography & Actions OR Workspace */}
          <div className="flex-1 lg:max-w-xl xl:max-w-3xl 2xl:max-w-5xl relative z-20 h-full flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!isWorkspaceActive ? (
                <motion.div
                  key="landing"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                  transition={{ duration: 0.4 }}
                  className="w-full flex-1 flex flex-col justify-center"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded font-mono text-xs md:text-sm text-zinc-400 uppercase tracking-widest mb-8 backdrop-blur-sm"
                >
                  <Network className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
                  Incident Intelligence Engine
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="font-display font-bold tracking-tight text-zinc-100 leading-[1.1] mb-6 text-4xl md:text-5xl lg:text-6xl"
                >
                  Pinpoint systemic failures <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 italic pb-2 inline-block">
                    instantly.
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-zinc-400 font-light leading-relaxed max-w-xl 2xl:max-w-3xl mb-10 text-base md:text-lg lg:text-xl"
                >
                  RootSight connects telemetry across your microservices, vendors, and teams. Map cascading symptoms directly to their original cause without digging through logs.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex flex-col sm:flex-row gap-5 sm:items-center"
                >
                  <button
                    onClick={handleInitialize}
                    className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-950 font-bold uppercase tracking-wider text-sm transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] active:scale-95"
                  >
                    Initialize Analysis
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                  <button className="flex items-center justify-center gap-2 px-6 py-4 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 rounded text-zinc-300 font-bold uppercase tracking-wider text-xs transition-all backdrop-blur-sm">
                     <TerminalSquare className="w-4 h-4 text-zinc-500" />
                     View Documentation
                  </button>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 font-mono text-xs text-zinc-500 uppercase tracking-widest font-semibold"
                >
                   <span>&gt; Analyzes 40+ APM sources</span>
                   <span className="hidden sm:inline">•</span>
                   <span>&gt; Sub-second graph traversal</span>
                </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="workspace"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="h-full pt-4 w-full flex-1 flex flex-col"
                >
                  <IntelligenceWorkspace onComplete={() => onNavigate('dashboard')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Platform Visual - Animated Graph */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block relative flex-1 w-full max-w-[600px] xl:max-w-[800px] 2xl:max-w-[1000px] aspect-square"
              >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.22)_0%,rgba(239,68,68,0.05)_12%,transparent_25%)] pointer-events-none z-0 mix-blend-screen" />
                 
                 {/* Expanding Rings / Investigation Boundaries */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-40 pointer-events-none z-0">
                    <motion.div 
                       initial={{ scale: 0.6, opacity: 0 }}
                       animate={{ scale: 1.2, opacity: [0, 0.7, 0] }} 
                       transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }} 
                       className="absolute inset-0 rounded-2xl border border-red-500/70" 
                    />
                    <motion.div 
                       initial={{ scale: 0.6, opacity: 0 }}
                       animate={{ scale: 1.2, opacity: [0, 0.7, 0] }} 
                       transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1.5 }} 
                       className="absolute inset-0 rounded-2xl border border-red-500/70" 
                    />
                 </div>

                 <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                    <defs>
                      <mask id="node-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <circle cx="50%" cy="50%" r="85" fill="black" />
                        <circle cx="28%" cy="72%" r="45" fill="black" />
                        <circle cx="28%" cy="28%" r="45" fill="black" />
                        <circle cx="72%" cy="28%" r="45" fill="black" />
                        <circle cx="72%" cy="72%" r="45" fill="black" />
                      </mask>
                    </defs>
                    
                    <g mask="url(#node-mask)">
                       {/* Gateway Path (Gateway -> Root Cause) - Warning */}
                    <line x1="28%" y1="72%" x2="50%" y2="50%" stroke="#3f3f46" strokeWidth="2" strokeDasharray="4 4" className="opacity-60" />
                    <motion.line x1="28%" y1="72%" x2="50%" y2="50%" stroke="#f59e0b" strokeWidth="3" 
                      initial={{ opacity: 0.1 }}
                      animate={{ opacity: [0.1, 0.8, 0.1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                      style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.6))" }}
                    />
                    
                    {/* Primary DB Path (Healthy) */}
                    <line x1="72%" y1="28%" x2="50%" y2="50%" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" className="opacity-40" />
                    
                     {/* Active Investigation Path (Symptoms -> Root Cause) */}
                    <line x1="28%" y1="28%" x2="50%" y2="50%" stroke="#3f3f46" strokeWidth="2" strokeDasharray="4 4" className="opacity-60" />
                    <motion.line x1="28%" y1="28%" x2="50%" y2="50%" stroke="#f59e0b" strokeWidth="3" 
                      initial={{ opacity: 0.1 }}
                      animate={{ opacity: [0.1, 0.8, 0.1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.6))" }}
                    />
                    
                    {/* Active Investigation Path (Int Services -> Root Cause) */}
                    <line x1="72%" y1="72%" x2="50%" y2="50%" stroke="#cf7070" strokeWidth="2" strokeDasharray="4 4" className="opacity-40" />
                    <motion.line x1="72%" y1="72%" x2="50%" y2="50%" stroke="#ef4444" strokeWidth="4" 
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
                      style={{ filter: "drop-shadow(0 0 12px rgba(239,68,68,0.9))" }}
                    />

                    {/* Subtle Data Orbs for Healthy Paths */}
                    {/* Primary DB -> Root Cause */}
                    <motion.circle r="3" fill="#0d9488" filter="drop-shadow(0 0 4px #0d9488)"
                      initial={{ cx: "72%", cy: "28%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 0.3, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.5 }}
                    />

                    {/* Bright Evidence Particles for Active Investigation */}
                    {/* Gateway -> Root Cause */}
                    <motion.circle r="4" fill="#f59e0b" filter="drop-shadow(0 0 8px #f59e0b)"
                      initial={{ cx: "28%", cy: "72%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.5 }}
                    />
                    {/* Proxy -> Root Cause */}
                    <motion.circle r="4" fill="#f59e0b" filter="drop-shadow(0 0 8px #f59e0b)"
                      initial={{ cx: "28%", cy: "28%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    {/* Int Services -> Root Cause */}
                    <motion.circle r="6" fill="#ef4444" filter="drop-shadow(0 0 12px #ef4444)"
                      initial={{ cx: "72%", cy: "72%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.75 }}
                    />
                    </g>
                 </svg>

                 {/* Center Node (Focal Point Incident) */}
                 <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-30">
                    <div className="w-40 bg-zinc-950 border border-red-500/40 rounded-xl relative shrink-0 overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.2)] font-mono z-20">
                      <motion.div 
                        animate={{ boxShadow: ['0 0 40px rgba(239,68,68,0.2)', '0 0 80px rgba(239,68,68,0.4)', '0 0 40px rgba(239,68,68,0.2)'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-xl pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />
                      
                      {/* Scanning Effect */}
                      <motion.div
                         animate={{ top: ['0%', '100%', '0%'] }}
                         transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                         className="absolute left-0 right-0 h-0.5 bg-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,1)] z-20 pointer-events-none"
                      />

                      {hasAnalyzed ? (
                        <>
                          <div className="px-3 py-2 flex items-center justify-center gap-2 border-b border-red-500/20 bg-red-500/10">
                            <ShieldAlert className="w-5 h-5 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0" />
                            <span className="text-xs md:text-sm text-red-400 uppercase tracking-widest font-bold flex-1 text-center">
                              Root Cause
                            </span>
                          </div>

                          <div className="p-4 flex flex-col gap-3">
                            <div className="text-sm md:text-base whitespace-nowrap font-semibold text-zinc-100 tracking-wide text-center">Auth Service</div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-400 uppercase tracking-widest">Confidence</span>
                              <span className="text-xs md:text-sm text-red-400 font-bold">{confidence}%</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 py-8 flex items-center justify-center h-[100px]">
                           <span className="text-lg text-red-400 uppercase tracking-widest font-bold text-center animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
                              Analyzing...
                           </span>
                        </div>
                      )}
                    </div>

                 </div>

                 {/* Peripheral Nodes */}
                 {[
                   { 
                     left: '28%', top: '72%', delay: 0, 
                     icon: <Code2 className="w-5 h-5 text-amber-500" />, 
                     label: 'Gateway',
                     status: { text: "Warning", type: "warning", color: "bg-amber-500", textColor: "text-amber-500/80" }
                   },
                   { 
                     left: '72%', top: '28%', delay: 1, 
                     icon: <Database className="w-5 h-5 text-teal-500" />, 
                     label: 'Primary DB',
                     status: { text: "Healthy", type: "healthy", color: "bg-teal-500", textColor: "text-teal-500/80" }
                   },
                   { 
                     left: '28%', top: '28%', delay: 0.5, 
                     icon: <Activity className="w-5 h-5 text-amber-500" />, 
                     label: 'Proxy Layer',
                     status: { text: "Warning", type: "warning", color: "bg-amber-500", textColor: "text-amber-500/80" },
                     badge: (
                       <motion.div 
                         initial={{ opacity: 0, y: 5 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: 1.5 }}
                         className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] md:text-xs font-mono text-amber-400 flex items-center gap-1 whitespace-nowrap bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm rounded pointer-events-none"
                       >
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(245,158,11,0.8)]"></div>
                          High Latency
                       </motion.div>
                     )
                   },
                   { 
                     left: '72%', top: '72%', delay: 1.5, 
                     icon: <Server className="w-5 h-5 text-red-500" />, 
                     label: 'Int Services',
                     status: { text: "Impacted", type: "impacted", color: "bg-red-500", textColor: "text-red-500/80" },
                     badge: (
                       <motion.div 
                         initial={{ opacity: 0, y: 5 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: 2.2 }}
                         className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] md:text-xs font-mono text-red-400 flex items-center gap-1 whitespace-nowrap bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm rounded pointer-events-none"
                       >
                          <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
                          Login Failures
                       </motion.div>
                     )
                   },
                 ].map((node, i) => (
                   <motion.div 
                     key={i}
                     initial={{ opacity: 0, scale: 0.5 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.5, delay: 0.5 + node.delay * 0.2 }}
                     className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                     style={{ left: node.left, top: node.top }}
                   >
                      {node.badge}
                     <div className="w-14 h-14 rounded border border-zinc-700/50 bg-zinc-900/80 shadow-xl flex items-center justify-center backdrop-blur-md relative z-0">
                         {node.icon}
                      </div>
                      <div className="-mt-2 flex flex-col items-center bg-zinc-900/95 border border-zinc-700/80 px-3 py-2 rounded shadow-lg z-10 relative pointer-events-none min-w-[80px]">
                        <span className="text-xs font-mono uppercase tracking-widest text-zinc-300 whitespace-nowrap leading-none mb-1">
                           {node.label}
                        </span>
                        <div className="flex items-center gap-1.5 opacity-90">
                          <div className={`w-1.5 h-1.5 rounded-full ${node.status.color}`} />
                          <span className={`text-xs font-mono uppercase tracking-wider leading-none ${node.status.textColor}`}>
                            {node.status.text}
                          </span>
                        </div>
                      </div>
                   </motion.div>
                 ))}
              </motion.div>
        </div>
      </main>
      
      {/* Footer info widget */}
      <footer className="relative z-10 w-full px-8 lg:px-16 flex justify-between items-end border-t border-zinc-900 pt-6 pb-8">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1">Session Data</div>
          <div className="font-mono text-xs text-zinc-400">Node ID: a3f9-b82c</div>
          <div className="font-mono text-xs text-zinc-400">Encryption: AES-256</div>
        </div>
      </footer>
    </div>
  );
}
