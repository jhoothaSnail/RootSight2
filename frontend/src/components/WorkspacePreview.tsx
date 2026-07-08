import { motion } from 'motion/react';
import { Activity, GitBranch, ShieldAlert, BookOpen } from 'lucide-react';

// A small fixed dependency-graph layout used purely for visual texture on the
// auth screens — not connected to real graph data. Coordinates are in a
// 0-400 x 0-300 viewBox.
const NODES = [
  { id: 'gateway', x: 200, y: 40, label: 'API Gateway', tone: 'amber' },
  { id: 'auth', x: 90, y: 120, label: 'Auth Service', tone: 'teal' },
  { id: 'billing', x: 200, y: 150, label: 'Billing', tone: 'teal' },
  { id: 'payments', x: 310, y: 120, label: 'Stripe', tone: 'zinc' },
  { id: 'db', x: 140, y: 230, label: 'Postgres', tone: 'teal' },
  { id: 'queue', x: 260, y: 230, label: 'Queue', tone: 'zinc' },
  { id: 'root', x: 90, y: 230, label: 'Root Cause', tone: 'red' },
] as const;

const EDGES: Array<[string, string]> = [
  ['gateway', 'auth'],
  ['gateway', 'billing'],
  ['gateway', 'payments'],
  ['auth', 'db'],
  ['billing', 'db'],
  ['billing', 'queue'],
  ['auth', 'root'],
];

const TONE_FILL: Record<string, string> = {
  amber: '#f59e0b',
  teal: '#14b8a6',
  zinc: '#71717a',
  red: '#ef4444',
};

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

const ACTIVITY_FEED = [
  { icon: ShieldAlert, text: 'Root cause identified — Auth Service', tone: 'text-red-400', time: '2m ago' },
  { icon: GitBranch, text: 'Dependency graph updated — 3 new services', tone: 'text-teal-400', time: '18m ago' },
  { icon: BookOpen, text: 'Runbook generated for Billing timeout', tone: 'text-amber-400', time: '1h ago' },
];

export default function WorkspacePreview() {
  return (
    <div className="relative z-10 flex flex-col justify-center px-16 max-w-xl mx-auto w-full">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded font-mono text-xs text-zinc-400 uppercase tracking-widest mb-6 backdrop-blur-sm w-fit">
        <Activity className="w-4 h-4 text-amber-500" />
        Live Dependency Graph
      </div>

      {/* Animated graph card */}
      <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden mb-6">
        <svg viewBox="0 0 400 300" className="w-full h-64">
          {EDGES.map(([from, to], i) => {
            const a = byId[from];
            const b = byId[to];
            return (
              <motion.line
                key={`${from}-${to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#3f3f46"
                strokeWidth={1.5}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, delay: 0.15 * i, ease: 'easeOut' }}
              />
            );
          })}

          {/* Root-cause pulse ring, drawing the eye to where the RCA landed */}
          <motion.circle
            cx={byId.root.x}
            cy={byId.root.y}
            r={10}
            fill="none"
            stroke="#ef4444"
            strokeWidth={1.5}
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: [0.8, 2.2], opacity: [0.7, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            style={{ transformOrigin: `${byId.root.x}px ${byId.root.y}px` }}
          />

          {NODES.map((n, i) => (
            <g key={n.id}>
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={n.id === 'root' ? 8 : 6}
                fill={TONE_FILL[n.tone]}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.15 * i + 0.3 }}
              />
              <text
                x={n.x}
                y={n.y - 12}
                textAnchor="middle"
                className="fill-zinc-500"
                fontSize={9}
                fontFamily="monospace"
                letterSpacing={0.5}
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <h2 className="font-display font-bold tracking-tight text-zinc-100 text-3xl xl:text-4xl leading-tight mb-5">
        Every past analysis, <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 italic">
          one workspace away.
        </span>
      </h2>
      <p className="text-zinc-400 font-light leading-relaxed text-base xl:text-lg mb-8">
        Your architecture maps, root cause analyses, and runbooks persist across sessions —
        sign in to pick up exactly where you left off.
      </p>

      {/* Recent activity feed — reinforces "persistent workspace", not a one-off tool */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm divide-y divide-zinc-800/80">
        {ACTIVITY_FEED.map((item, i) => (
          <motion.div
            key={item.text}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
            className="flex items-center gap-3 px-4 py-3"
          >
            <item.icon className={`w-4 h-4 shrink-0 ${item.tone}`} />
            <span className="flex-1 text-sm text-zinc-300 truncate">{item.text}</span>
            <span className="text-xs font-mono text-zinc-600 shrink-0">{item.time}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
