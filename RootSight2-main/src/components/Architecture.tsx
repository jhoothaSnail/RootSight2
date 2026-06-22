import { motion } from 'motion/react';
import { Database, KeyRound, MessageSquare, CreditCard, Box, UserPlus, Globe, Building2, Server } from 'lucide-react';

export default function Architecture() {
  const components = [
    { name: 'API Gateway', icon: <Globe />, type: 'Ingress', status: 'warning', metrics: '45ms latency' },
    { name: 'Login Service', icon: <KeyRound />, type: 'Auth', status: 'critical', metrics: '504 Timeouts' },
    { name: 'Registration', icon: <UserPlus />, type: 'Auth', status: 'critical', metrics: 'Cascading Fault' },
    { name: 'Password Reset', icon: <KeyRound />, type: 'Auth', status: 'warning', metrics: 'Rate Limited' },
    { name: 'Team Creation', icon: <Box />, type: 'Core', status: 'warning', metrics: 'High Queue' },
    { name: 'Billing', icon: <CreditCard />, type: 'Finance', status: 'healthy', metrics: 'Nominal' },
    { name: 'Notifications', icon: <MessageSquare />, type: 'Comms', status: 'healthy', metrics: 'Nominal' },
    { name: 'PostgreSQL DB', icon: <Database />, type: 'Storage', status: 'healthy', metrics: '24% Load' },
  ];

  return (
    <div className="h-screen pt-10 px-8 pb-8 overflow-y-auto bg-zinc-950">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100 mb-1 uppercase tracking-tight">Global Architecture Map</h1>
            <p className="text-sm font-mono text-zinc-400">Holistic bird's-eye view of microservice health and dependency states.</p>
          </div>
          <div className="flex gap-4 bg-[#0d0d0f] p-2 px-4 rounded border border-zinc-900">
             <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400"><span className="w-2 h-2 rounded-full bg-teal-500"></span> Healthy</div>
             <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Warning</div>
             <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Critical</div>
          </div>
        </header>

        <div>
           <div className="text-xs font-mono tracking-widest text-zinc-600 uppercase mb-4 flex items-center gap-2 border-b border-zinc-900 pb-2">
             <Server className="w-4 h-4" /> Internal Microservices
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {components.map((comp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-4 rounded border relative overflow-hidden flex flex-col justify-between min-h-[140px] ${
                  comp.status === 'critical' ? 'bg-red-500/5 border-red-500/30' :
                  comp.status === 'warning' ? 'bg-amber-500/5 border-amber-500/30' :
                  'bg-[#0d0d0f] border-zinc-900'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className={`p-2 rounded ${
                    comp.status === 'critical' ? 'bg-red-500/20 text-red-500' :
                    comp.status === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                    'bg-teal-500/10 text-teal-400'
                  }`}>
                    {comp.icon}
                  </div>
                  <div className="text-[10px] uppercase font-mono tracking-widest font-bold text-zinc-600">
                    {comp.type}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-200 text-sm mb-1">{comp.name}</h3>
                  <div className={`text-[10px] font-mono uppercase tracking-wider ${
                    comp.status === 'critical' ? 'text-red-400' :
                    comp.status === 'warning' ? 'text-amber-500' :
                    'text-teal-500'
                  }`}>
                    {comp.metrics}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        <div className="pt-6">
           <div className="text-xs font-mono tracking-widest text-zinc-600 uppercase mb-4 flex items-center gap-2 border-b border-zinc-900 pb-2">
             <Building2 className="w-4 h-4" /> External Vendorships
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded border bg-red-500/5 border-red-500/30 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-semibold text-zinc-200">Google OAuth API</div>
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-[8px] font-mono uppercase tracking-widest text-red-500 font-bold animate-pulse">Critical</span>
                    </div>
                    <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Degraded • 504 Timeout</div>
                  </div>
                  <Globe className="w-6 h-6 text-red-500/50" />
                </div>
                <div className="flex items-center gap-6 text-[10px] font-mono border-t border-red-500/10 pt-3">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-zinc-500 uppercase tracking-wider">Affected Services</span>
                     <span className="text-zinc-200 font-bold text-xs">4</span>
                   </div>
                   <div className="flex flex-col gap-0.5">
                     <span className="text-zinc-500 uppercase tracking-wider">Affected Users</span>
                     <span className="text-zinc-200 font-bold text-xs">12.4k</span>
                   </div>
                </div>
              </div>
              <div className="p-4 rounded border bg-[#0d0d0f] border-zinc-900 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-semibold text-zinc-200">Twilio Webhooks</div>
                      <span className="px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[8px] font-mono uppercase tracking-widest text-teal-500 font-bold">Healthy</span>
                    </div>
                    <div className="text-[10px] font-mono text-teal-500 uppercase tracking-widest">Stable Response</div>
                  </div>
                  <Globe className="w-6 h-6 text-zinc-700" />
                </div>
                <div className="flex items-center gap-6 text-[10px] font-mono border-t border-zinc-800/50 pt-3">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-zinc-500 uppercase tracking-wider">Affected Services</span>
                     <span className="text-zinc-400 font-bold text-xs">0</span>
                   </div>
                   <div className="flex flex-col gap-0.5">
                     <span className="text-zinc-500 uppercase tracking-wider">Affected Users</span>
                     <span className="text-zinc-400 font-bold text-xs">0</span>
                   </div>
                </div>
              </div>
              <div className="p-4 rounded border bg-[#0d0d0f] border-zinc-900 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-semibold text-zinc-200">Razorpay Payment</div>
                      <span className="px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[8px] font-mono uppercase tracking-widest text-teal-500 font-bold">Healthy</span>
                    </div>
                    <div className="text-[10px] font-mono text-teal-500 uppercase tracking-widest">Stable Response</div>
                  </div>
                  <Globe className="w-6 h-6 text-zinc-700" />
                </div>
                <div className="flex items-center gap-6 text-[10px] font-mono border-t border-zinc-800/50 pt-3">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-zinc-500 uppercase tracking-wider">Affected Services</span>
                     <span className="text-zinc-400 font-bold text-xs">0</span>
                   </div>
                   <div className="flex flex-col gap-0.5">
                     <span className="text-zinc-500 uppercase tracking-wider">Affected Users</span>
                     <span className="text-zinc-400 font-bold text-xs">0</span>
                   </div>
                </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
