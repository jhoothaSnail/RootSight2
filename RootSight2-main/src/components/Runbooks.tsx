import { motion } from 'motion/react';
import { Play, Bot, Shield, FileOutput, ServerCrash, FastForward } from 'lucide-react';

export default function Runbooks() {
  const playbooks = [
    {
      id: "RB-001",
      title: "Google OAuth Fallback to Email Protocol",
      trigger: "OAuth Gateway >= 500ms latency OR 502/504 errors",
      actions: [
        "Isolate OAuth ingress routes.",
        "Toggle feature flag: `enable_magic_link_auth` to TRUE.",
        "Notify Team Alpha via PagerDuty."
      ],
      confidence: 96,
      auto: true,
      status: "Ready to Execute"
    },
    {
      id: "RB-002",
      title: "Database Connection Pool Reset",
      trigger: "PostgreSQL active connections > 85%",
      actions: [
        "Force drain idle connections.",
        "Scale read-replicas by +2 nodes.",
        "Disable long-polling queries temporarily."
      ],
      confidence: 81,
      auto: false,
      status: "Manual Approval Required"
    },
    {
      id: "RB-003",
      title: "Aggressive Traffic Shedding",
      trigger: "API Gateway Memory Load > 90%",
      actions: [
        "Drop all unauthenticated traffic.",
        "Rate limit tier-free users to 5 req/min.",
        "Cache /products endpoint at Edge."
      ],
      confidence: 99,
      auto: true,
      status: "Active Monitoring"
    }
  ];

  return (
    <div className="h-screen pt-10 px-8 pb-8 overflow-y-auto bg-zinc-950">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header className="mb-8">
          <h1 className="text-2xl font-display font-bold text-zinc-100 mb-1 uppercase tracking-tight">AI Remediation Runbooks</h1>
          <p className="text-sm font-mono text-zinc-400">Automated playbooks generated from historical incident graphs.</p>
        </header>

        <div className="space-y-4">
          {playbooks.map((pb, i) => (
            <motion.div 
              key={pb.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#0d0d0f] border border-zinc-900 rounded p-5 relative overflow-hidden group"
            >
              {pb.auto && (
                 <div className="absolute top-0 right-0 p-3">
                   <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-500 uppercase tracking-widest font-bold">
                     <Bot className="w-3.5 h-3.5" /> Auto-Exec Enabled
                   </div>
                 </div>
              )}
              
              <div className="flex items-start gap-4 mb-4">
                 <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
                    <FileOutput className="w-5 h-5" />
                 </div>
                 <div>
                    <div className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-500 inline-block mb-1">
                      {pb.id}
                    </div>
                    <h2 className="text-lg font-semibold text-zinc-100">{pb.title}</h2>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900 border-l-amber-500 border-l-2">
                   <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1.5">Trigger Condition</div>
                   <div className="text-zinc-300 font-mono text-xs">{pb.trigger}</div>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900 flex flex-col justify-center">
                   <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1.5 flex justify-between">
                     <span>AI Confidence Score</span>
                     <span className="text-cyan-400">{pb.confidence}%</span>
                   </div>
                   <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                     <div className="h-full bg-cyan-500" style={{ width: `${pb.confidence}%` }}></div>
                   </div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Execution Steps</div>
                <ul className="space-y-1.5">
                  {pb.actions.map((act, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs font-mono text-zinc-400">
                      <span className="text-zinc-600 mt-0.5">[{j + 1}]</span> {act}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end pt-4 border-t border-zinc-900">
                <button className={`px-4 py-2 font-bold uppercase tracking-wider text-[10px] transition-colors rounded flex items-center gap-2
                  ${pb.auto 
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                  }`}
                >
                  <Play className="w-3 h-3" />
                  {pb.auto ? 'Managed by AI Agent' : 'Execute Manually'}
                </button>
              </div>

            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
