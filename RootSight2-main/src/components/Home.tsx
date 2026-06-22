import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Activity, Code2, Network, TerminalSquare, Database, ShieldAlert, Server } from 'lucide-react';
import { Logo } from './Logo';

interface HomeProps {
  onNavigate: (view: 'dashboard') => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(-1);
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
    setIsInitializing(true);
    setTimeout(() => setLoadingStep(0), 400);    
    setTimeout(() => setLoadingStep(1), 1200);
    setTimeout(() => setLoadingStep(2), 2000);
    setTimeout(() => {
      onNavigate('dashboard');
    }, 3000);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-zinc-950 px-6 sm:px-12 py-8 selection:bg-amber-500/30">
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

      <header className="relative z-10 flex items-center justify-between w-full max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <Logo className="w-8 h-8 drop-shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
          <span className="font-display font-semibold text-xl tracking-wide text-zinc-100 uppercase">RootSight</span>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-zinc-800 bg-zinc-900/50 rounded text-zinc-400 text-xs font-mono tracking-widest uppercase backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
          Platform Status: Nominal
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col justify-center w-full max-w-[1400px] mx-auto py-12">
        <AnimatePresence mode="wait">
          {!isInitializing ? (
            <motion.div
              key="landing"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
              transition={{ duration: 0.4 }}
              className="flex flex-col lg:flex-row items-center justify-between gap-16 w-full"
            >
              {/* Left Column: Typography & Actions */}
              <div className="flex-1 max-w-2xl relative z-20">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900/80 border border-zinc-800 rounded font-mono text-[10px] text-zinc-400 uppercase tracking-widest mb-8 backdrop-blur-sm"
                >
                  <Network className="w-3.5 h-3.5 text-amber-500" />
                  Incident Intelligence Engine
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-100 leading-[1.05] mb-6"
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
                  className="text-lg text-zinc-400 font-light leading-relaxed max-w-xl mb-10"
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
                  className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 font-mono text-[10px] text-zinc-600 uppercase tracking-widest font-semibold"
                >
                   <span>&gt; Analyzes 40+ APM sources</span>
                   <span className="hidden sm:inline">•</span>
                   <span>&gt; Sub-second graph traversal</span>
                </motion.div>
              </div>

              {/* Right Column: Platform Visual - Animated Graph */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="hidden lg:block relative w-full max-w-[600px] aspect-square"
              >
                 <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-red-500/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
                 
                 <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                    <line x1="28%" y1="72%" x2="50%" y2="50%" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" className="opacity-40" />
                    <line x1="72%" y1="28%" x2="50%" y2="50%" stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" className="opacity-40" />
                    
                    {/* Active Investigation Path (Symptoms -> Root Cause) */}
                    <line x1="28%" y1="28%" x2="50%" y2="50%" stroke="#3f3f46" strokeWidth="2" strokeDasharray="4 4" className="opacity-60" />
                    <motion.line x1="28%" y1="28%" x2="50%" y2="50%" stroke="#f59e0b" strokeWidth="3" 
                      initial={{ opacity: 0.1 }}
                      animate={{ opacity: [0.1, 0.8, 0.1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.6))" }}
                    />
                    
                    {/* Active Investigation Path (Root Cause -> Impact) */}
                    <line x1="50%" y1="50%" x2="72%" y2="72%" stroke="#3f3f46" strokeWidth="2" strokeDasharray="4 4" className="opacity-60" />
                    <motion.line x1="50%" y1="50%" x2="72%" y2="72%" stroke="#ef4444" strokeWidth="3" 
                      initial={{ opacity: 0.1 }}
                      animate={{ opacity: [0.1, 0.8, 0.1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.75 }}
                      style={{ filter: "drop-shadow(0 0 6px rgba(239,68,68,0.6))" }}
                    />

                    {/* Subtle Data Orbs for Healthy Paths */}
                    <motion.circle r="3" fill="#0d9488" filter="drop-shadow(0 0 4px #0d9488)"
                      initial={{ cx: "72%", cy: "28%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 0.3, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 0.5 }}
                    />
                    <motion.circle r="3" fill="#0d9488" filter="drop-shadow(0 0 4px #0d9488)"
                      initial={{ cx: "28%", cy: "72%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 0.3, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
                    />

                    {/* Bright Evidence Particles for Active Investigation */}
                    {/* Proxy -> Root Cause */}
                    <motion.circle r="4" fill="#f59e0b" filter="drop-shadow(0 0 8px #f59e0b)"
                      initial={{ cx: "28%", cy: "28%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    {/* Int Services -> Root Cause */}
                    <motion.circle r="4" fill="#ef4444" filter="drop-shadow(0 0 8px #ef4444)"
                      initial={{ cx: "72%", cy: "72%", opacity: 0 }}
                      animate={{ cx: "50%", cy: "50%", opacity: [0, 1, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.75 }}
                    />
                 </svg>

                 {/* Center Node (Focal Point Incident) */}
                 <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-30">
                    <div className="w-40 bg-zinc-950 border border-red-500/40 rounded-xl relative shrink-0 overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.2)] font-mono z-20">
                      <motion.div 
                        animate={{ boxShadow: ['0 0 20px rgba(239,68,68,0.1)', '0 0 40px rgba(239,68,68,0.3)', '0 0 20px rgba(239,68,68,0.1)'] }}
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
                            <ShieldAlert className="w-4 h-4 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0" />
                            <span className="text-[10px] text-red-400 uppercase tracking-widest font-bold flex-1 text-center">
                              Root Cause
                            </span>
                          </div>

                          <div className="p-3 flex flex-col gap-3">
                            <div className="text-sm font-semibold text-zinc-100 tracking-wide text-center">Auth Service</div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Confidence</span>
                              <span className="text-[11px] text-red-400 font-bold">{confidence}%</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 py-8 flex items-center justify-center h-[96px]">
                           <span className="text-base text-red-400 uppercase tracking-widest font-bold text-center animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
                              Analyzing...
                           </span>
                        </div>
                      )}
                    </div>

                    {/* Expanding Rings */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 pointer-events-none z-10">
                      <motion.div 
                         initial={{ scale: 1.5, opacity: 0 }}
                         animate={{ scale: 0.8, opacity: [0, 0.3, 0] }} 
                         transition={{ duration: 3, repeat: Infinity, ease: "easeIn" }} 
                         className="absolute inset-0 rounded-2xl border border-red-500/20" 
                      />
                      <motion.div 
                         initial={{ scale: 1.5, opacity: 0 }}
                         animate={{ scale: 0.8, opacity: [0, 0.3, 0] }} 
                         transition={{ duration: 3, repeat: Infinity, ease: "easeIn", delay: 1.5 }} 
                         className="absolute inset-0 rounded-2xl border border-red-500/20" 
                      />
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
                     icon: <Database className="w-5 h-5 text-teal-600/60" />, 
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
                         className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-mono text-amber-400 flex items-center gap-1 whitespace-nowrap bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm rounded pointer-events-none"
                       >
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(245,158,11,0.8)]"></div>
                          High Latency
                       </motion.div>
                     )
                   },
                   { 
                     left: '72%', top: '72%', delay: 1.5, 
                     icon: <Server className="w-5 h-5 text-red-500/80" />, 
                     label: 'Int Services',
                     status: { text: "Impacted", type: "impacted", color: "bg-red-500", textColor: "text-red-500/80" },
                     badge: (
                       <motion.div 
                         initial={{ opacity: 0, y: 5 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: 2.2 }}
                         className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[9px] font-mono text-red-400 flex items-center gap-1 whitespace-nowrap bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-sm rounded pointer-events-none"
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
                     className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                     style={{ left: node.left, top: node.top }}
                   >
                      {node.badge}
                      <div className="w-11 h-11 rounded border border-zinc-700/50 bg-zinc-900/80 flex items-center justify-center backdrop-blur-md shadow-xl relative z-0">
                         {node.icon}
                      </div>
                      <div className="-mt-2 flex flex-col items-center bg-zinc-900/95 border border-zinc-700/80 px-2 py-1 rounded shadow-lg z-10 relative pointer-events-none min-w-[64px]">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-300 whitespace-nowrap leading-none mb-1">
                           {node.label}
                        </span>
                        <div className="flex items-center gap-1.5 opacity-90">
                          <div className={`w-1 h-1 rounded-full ${node.status.color}`} />
                          <span className={`text-[8px] font-mono uppercase tracking-wider leading-none ${node.status.textColor}`}>
                            {node.status.text}
                          </span>
                        </div>
                      </div>
                   </motion.div>
                 ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 m-auto flex flex-col items-center justify-center w-full max-w-lg h-fit pointer-events-none"
            >
              <div className="relative flex items-center justify-center w-40 h-40 mb-10">
                <svg className="absolute inset-0 w-full h-full animate-[spin_4s_linear_infinite]" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="10 5" className="text-amber-500/30" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="60 200" className="text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" strokeLinecap="round" />
                  <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="100 100" className="text-red-500/80" strokeDashoffset="50" strokeLinecap="round" />
                </svg>
                <motion.div
                  animate={{ scale: [1, 1.1, 1], filter: ['drop-shadow(0 0 10px rgba(245,158,11,0.4))', 'drop-shadow(0 0 25px rgba(245,158,11,0.8))', 'drop-shadow(0 0 10px rgba(245,158,11,0.4))'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Logo className="w-14 h-14" />
                </motion.div>
              </div>
              
              <div className="text-amber-500 font-mono text-sm tracking-widest uppercase mb-8 font-bold animate-pulse text-center drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                Ingesting Telemetry...
              </div>
              
              <div className="w-full bg-[#0d0d0f] border border-zinc-900 rounded p-5 text-sm font-mono text-zinc-400 space-y-3 min-h-[120px] max-w-[360px] shadow-2xl relative overflow-hidden">
                 <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none" />
                 <div className={`transition-opacity duration-300 ${loadingStep >= 0 ? 'opacity-100' : 'opacity-0'}`}>
                   <span className="text-amber-500/50 mr-3">&gt;&gt;</span> Connecting to DataDog APIs...
                 </div>
                 <div className={`transition-opacity duration-300 ${loadingStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
                   <span className="text-amber-500/50 mr-3">&gt;&gt;</span> Parsing access logs...
                 </div>
                 <div className={`transition-opacity duration-300 ${loadingStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
                   <span className="text-amber-500/50 mr-3">&gt;&gt;</span> Correlating incidents...
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Footer info widget */}
      <footer className="relative z-10 w-full max-w-[1400px] mx-auto flex justify-between items-end border-t border-zinc-900 pt-6">
        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Session Data</div>
          <div className="font-mono text-[10px] text-zinc-400">Node ID: a3f9-b82c</div>
          <div className="font-mono text-[10px] text-zinc-400">Encryption: AES-256</div>
        </div>
      </footer>
    </div>
  );
}
