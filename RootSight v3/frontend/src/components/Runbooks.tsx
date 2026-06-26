import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Bot, FileOutput } from 'lucide-react';
import type { Runbook } from '../types';
import { getRunbooks, ApiClientError } from '../api/client';
import { LoadingState, ErrorState, EmptyState } from './States';

export default function Runbooks() {
  const [playbooks, setPlaybooks] = useState<Runbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRunbooks();
      setPlaybooks(res.runbooks);
    } catch (err) {
      if (err instanceof ApiClientError) setError({ message: err.message, code: err.code });
      else setError({ message: 'Failed to load remediation runbooks.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex-1 w-full pt-10 px-4 md:px-8 pb-8 overflow-y-auto bg-zinc-950">
      <div className="w-full space-y-6">

        <header className="mb-8">
          <h1 className="font-display font-bold text-zinc-100 mb-1 uppercase tracking-tight text-3xl md:text-4xl lg:text-5xl">AI Remediation Runbooks</h1>
          <p className="font-mono text-zinc-400 text-sm md:text-base">Automated playbooks generated from historical incident graphs.</p>
        </header>

        {loading ? (
          <div className="h-[50vh]"><LoadingState label="Generating runbooks..." /></div>
        ) : error ? (
          <div className="h-[50vh]"><ErrorState message={error.message} code={error.code} onRetry={load} /></div>
        ) : playbooks.length === 0 ? (
          <div className="h-[50vh]"><EmptyState label="No runbooks available yet." /></div>
        ) : (
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
                     <div className="flex items-center gap-1.5 text-xs md:text-sm font-mono text-cyan-500 uppercase tracking-widest font-bold">
                       <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" /> Auto-Exec Enabled
                     </div>
                   </div>
                )}

                <div className="flex items-start gap-4 mb-4">
                   <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
                      <FileOutput className="w-5 h-5" />
                   </div>
                   <div>
                      <div className="text-xs md:text-sm font-mono bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 text-zinc-500 inline-block mb-1">
                        {pb.id}
                      </div>
                      <h2 className="text-xl md:text-2xl font-semibold text-zinc-100">{pb.title}</h2>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
                  <div className="bg-zinc-950 p-4 rounded border border-zinc-900 border-l-amber-500 border-l-2">
                     <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-widest mb-2">Trigger Condition</div>
                     <div className="text-zinc-300 font-mono text-xs md:text-sm">{pb.trigger}</div>
                  </div>
                  <div className="bg-zinc-950 p-4 rounded border border-zinc-900 flex flex-col justify-center">
                     <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-widest mb-2 flex justify-between">
                       <span>AI Confidence Score</span>
                       <span className="text-cyan-400 font-bold">{pb.confidence}%</span>
                     </div>
                     <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                       <div className="h-full bg-cyan-500" style={{ width: `${pb.confidence}%` }}></div>
                     </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="text-xs md:text-sm text-zinc-500 font-mono uppercase tracking-widest">Execution Steps</div>
                  <ul className="space-y-2">
                    {pb.actions.map((act, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs md:text-sm font-mono text-zinc-400">
                        <span className="text-zinc-600 mt-0.5">[{j + 1}]</span> {act}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center pt-5 border-t border-zinc-900">
                  <span className="text-xs md:text-sm font-mono text-zinc-500 uppercase tracking-widest">{pb.status}</span>
                  <button className={`px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-colors rounded flex items-center gap-2
                    ${pb.auto
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    {pb.auto ? 'Managed by AI Agent' : 'Execute Manually'}
                  </button>
                </div>

              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
