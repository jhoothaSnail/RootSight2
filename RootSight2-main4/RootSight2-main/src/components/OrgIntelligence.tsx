import { motion } from 'motion/react';
import { Building2, AlertTriangle, Users, Wrench, ChevronRight } from 'lucide-react';

export default function OrgIntelligence() {
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
              <h2 className="text-xl md:text-2xl lg:text-3xl font-display font-bold text-zinc-100 mb-2">Vendor Risk: Google OAuth</h2>
              <p className="text-zinc-400 text-sm md:text-base lg:text-lg max-w-3xl leading-relaxed mb-5 font-mono">
                 Four tier-1 services [Login, Registration, Password Reset, Team Creation] depend directly on this vendor without localized fallback protocols. Vendor SLA (98.2%) is degrading overall system availability.
              </p>
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
          
          {/* Card 1: Team Risk */}
          <div className="bg-[#0d0d0f] border border-zinc-900 rounded p-5">
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-900 pb-3">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-cyan-500" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-zinc-300 uppercase tracking-widest">Ownership Burden</h3>
            </div>
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs md:text-sm font-mono">
                  <span className="text-zinc-300">Team Alpha</span>
                  <span className="text-red-400">80% Volatile Load</span>
                </div>
                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="w-[80%] h-full bg-red-500" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs md:text-sm font-mono">
                  <span className="text-zinc-300">Team Beta</span>
                  <span className="text-teal-400">35% Stable Load</span>
                </div>
                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="w-[35%] h-full bg-teal-500" />
                </div>
              </div>
              <div className="p-3 bg-cyan-500/5 rounded border border-cyan-500/10 mt-2">
                <p className="text-xs md:text-sm lg:text-base font-mono text-cyan-400 leading-relaxed uppercase">Recommendation: Reassign [Registration] service ownership to Team Beta to balance operational overhead.</p>
              </div>
            </div>
          </div>

          {/* Card 2: Subject Matter Experts */}
          <div className="bg-[#0d0d0f] border border-zinc-900 rounded p-5">
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-900 pb-3">
              <Wrench className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-zinc-300 uppercase tracking-widest">Key Responders</h3>
            </div>
            <div className="space-y-4">
              <div className="group flex items-center justify-between p-2 hover:bg-zinc-900 rounded transition-colors cursor-pointer border border-transparent hover:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded bg-zinc-800 flex items-center justify-center text-xs md:text-sm font-bold text-zinc-400 font-mono">
                    RH
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <div className="text-sm md:text-base font-semibold text-zinc-200">Rahul</div>
                       <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest">On Call</span>
                       </div>
                    </div>
                    <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-wider mt-0.5">Team Alpha</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs md:text-sm font-mono bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded border border-purple-500/20">
                    12 Refs
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </div>
              </div>
              
              <div className="group flex items-center justify-between p-2 hover:bg-zinc-900 rounded transition-colors cursor-pointer border border-transparent hover:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded bg-zinc-800 flex items-center justify-center text-xs md:text-sm font-bold text-zinc-400 font-mono">
                    AX
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <div className="text-sm md:text-base font-semibold text-zinc-200">Alex</div>
                       <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-red-500/10 border border-red-500/20">
                          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 animate-pulse"></span>
                          <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">In Incident</span>
                       </div>
                    </div>
                    <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-wider mt-0.5">Platform Team</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs md:text-sm font-mono bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded border border-zinc-700">
                    15 Refs
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </div>
              </div>

              <div className="group flex items-center justify-between p-2 hover:bg-zinc-900 rounded transition-colors cursor-pointer border border-transparent hover:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded bg-zinc-800 flex items-center justify-center text-xs md:text-sm font-bold text-zinc-400 font-mono">
                    PR
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <div className="text-sm md:text-base font-semibold text-zinc-200">Priya</div>
                       <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-zinc-800/50 border border-zinc-700/50">
                          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-600"></span>
                          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Idle</span>
                       </div>
                    </div>
                    <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-wider mt-0.5">Team Beta</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs md:text-sm font-mono bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded border border-zinc-700">
                    8 Refs
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Vendor Landscape */}
          <div className="bg-[#0d0d0f] border border-zinc-900 rounded p-5">
            <div className="flex items-center gap-3 mb-5 border-b border-zinc-900 pb-3">
              <Building2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
              <h3 className="font-mono text-xs md:text-sm lg:text-base font-semibold text-zinc-300 uppercase tracking-widest">Vendor Reliability</h3>
            </div>
            <div className="space-y-4">
               <div className="flex flex-col gap-1 p-2 rounded bg-red-500/5 border border-red-500/10">
                 <div className="flex justify-between items-center">
                   <span className="text-zinc-200 text-sm md:text-base font-semibold">Google OAuth</span>
                   <span className="text-red-400 font-mono text-xs md:text-sm flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" /> 98.2% (Degraded)
                   </span>
                 </div>
                 <div className="mt-1 flex items-center gap-2 text-xs md:text-sm font-mono">
                   <span className="text-zinc-500 uppercase tracking-widest">Downtime Duration:</span>
                   <span className="text-red-400 font-bold px-1.5 py-0.5 bg-red-500/10 rounded border border-red-500/20">42 mins</span>
                 </div>
               </div>
               <div className="flex flex-col gap-1 p-2">
                 <div className="flex justify-between items-center">
                   <span className="text-zinc-400 text-sm md:text-base">Razorpay</span>
                   <span className="text-emerald-400 font-mono text-xs md:text-sm">99.99% (Stable)</span>
                 </div>
                 <div className="mt-1 flex items-center gap-2 text-xs md:text-sm font-mono">
                   <span className="text-zinc-500 uppercase tracking-widest">Downtime Duration:</span>
                   <span className="text-zinc-400 px-1.5 py-0.5 bg-zinc-800/50 rounded border border-zinc-700/50">0 mins</span>
                 </div>
               </div>
               <div className="flex flex-col gap-1 p-2">
                 <div className="flex justify-between items-center">
                   <span className="text-zinc-400 text-sm md:text-base">Twilio</span>
                   <span className="text-emerald-400 font-mono text-xs md:text-sm">99.95% (Stable)</span>
                 </div>
                 <div className="mt-1 flex items-center gap-2 text-xs md:text-sm font-mono">
                   <span className="text-zinc-500 uppercase tracking-widest">Downtime Duration:</span>
                   <span className="text-zinc-400 px-1.5 py-0.5 bg-zinc-800/50 rounded border border-zinc-700/50">2 mins</span>
                 </div>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
