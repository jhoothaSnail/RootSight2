import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, GitBranch, ShieldAlert, Network, BookOpen } from 'lucide-react';

// A guided walkthrough of RootSight's investigation pipeline, shown on the
// auth screens as a product showcase (not connected to real incident data).
// Cycles automatically so the panel stays alive without needing interaction.
// Each step maps to one of RootSight's core value props: dependency
// intelligence, root cause analysis, blast radius analysis, organizational
// intelligence, and historical incident learning.
const STEPS = [
  {
    id: 'alert',
    icon: AlertTriangle,
    title: 'Alert Detected',
    metric: 'P1 · Reporting Service',
    detail: 'Incident ingested straight from your monitoring stack.',
    tone: 'amber',
  },
  {
    id: 'correlate',
    icon: GitBranch,
    title: 'Dependencies Correlated',
    metric: '14 nodes traversed',
    detail: 'Symptoms traced across services, vendors, and teams.',
    tone: 'amber',
  },
  {
    id: 'root-cause',
    icon: ShieldAlert,
    title: 'Root Cause Isolated',
    metric: '97% confidence',
    detail: 'AI pinpoints the true origin — not just the loudest alert.',
    tone: 'red',
  },
  {
    id: 'blast-radius',
    icon: Network,
    title: 'Blast Radius Mapped',
    metric: '6 services · 3 teams',
    detail: 'Every downstream service and team impacted, quantified.',
    tone: 'amber',
  },
  {
    id: 'runbook',
    icon: BookOpen,
    title: 'Runbook Generated',
    metric: '2 past incidents matched',
    detail: 'Remediation steps drawn from how this was resolved before.',
    tone: 'teal',
  },
] as const;

const TONE_STYLES: Record<
  string,
  { text: string; chipBg: string; chipBorder: string; ringBorder: string; glow: string; solid: string }
> = {
  amber: {
    text: 'text-amber-400',
    chipBg: 'bg-amber-500/10',
    chipBorder: 'border-amber-500/30',
    ringBorder: 'border-amber-500/50',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    solid: 'bg-amber-500',
  },
  red: {
    text: 'text-red-400',
    chipBg: 'bg-red-500/10',
    chipBorder: 'border-red-500/30',
    ringBorder: 'border-red-500/50',
    glow: 'shadow-[0_0_24px_rgba(239,68,68,0.35)]',
    solid: 'bg-red-500',
  },
  teal: {
    text: 'text-teal-400',
    chipBg: 'bg-teal-500/10',
    chipBorder: 'border-teal-500/30',
    ringBorder: 'border-teal-500/50',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.3)]',
    solid: 'bg-teal-500',
  },
};

const STEP_INTERVAL_MS = 2400;

export default function InvestigationTimeline() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-10 flex flex-col justify-center px-16 max-w-xl mx-auto w-full">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded font-mono text-xs text-zinc-400 uppercase tracking-widest mb-6 backdrop-blur-sm w-fit">
        <Activity className="w-4 h-4 text-amber-500" />
        How RootSight Investigates
      </div>

      <h2 className="font-display font-bold tracking-tight text-zinc-100 text-3xl xl:text-4xl leading-tight mb-4">
        From alert to root cause, <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 italic">
          automatically.
        </span>
      </h2>
      <p className="text-zinc-400 font-light leading-relaxed text-base xl:text-lg mb-8">
        RootSight traces every incident back to its true origin across services, vendors, and teams — then tells you exactly what to do next.
      </p>

      {/* Investigation timeline */}
      <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden mb-6 p-6">
        {STEPS.map((step, i) => {
          const tone = TONE_STYLES[step.tone];
          const isActive = i === activeStep;
          const isDone = i < activeStep;
          const nextTone = i < STEPS.length - 1 ? TONE_STYLES[STEPS[i + 1].tone] : TONE_STYLES.amber;
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative flex gap-4">
              {/* Icon + connector column */}
              <div className="flex flex-col items-center shrink-0">
                <motion.div
                  animate={{ scale: isActive ? 1.12 : 1 }}
                  transition={{ duration: 0.4 }}
                  className={`relative z-10 w-10 h-10 rounded-full border flex items-center justify-center shrink-0 bg-zinc-950 transition-colors duration-300 ${
                    isActive || isDone ? tone.ringBorder : 'border-zinc-800'
                  } ${isActive ? tone.glow : ''}`}
                >
                  <Icon className={`w-4 h-4 transition-colors duration-300 ${isActive || isDone ? tone.text : 'text-zinc-600'}`} />
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div className="w-px flex-1 min-h-[26px] bg-zinc-800 relative overflow-hidden my-1">
                    <motion.div
                      className={`absolute inset-x-0 top-0 w-px ${nextTone.solid}`}
                      initial={false}
                      animate={{ height: isDone ? '100%' : '0%' }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                    />
                  </div>
                )}
              </div>

              {/* Step content */}
              <div className={`flex-1 min-w-0 pb-6 transition-opacity duration-300 ${isActive || isDone ? 'opacity-100' : 'opacity-45'}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <h3 className={`text-sm md:text-base font-semibold transition-colors duration-300 ${isActive ? tone.text : 'text-zinc-200'}`}>
                    {step.title}
                  </h3>
                  <span
                    className={`text-[10px] md:text-xs font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 transition-colors duration-300 ${
                      isActive ? `${tone.chipBg} ${tone.chipBorder} ${tone.text}` : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    {step.metric}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-zinc-500 leading-relaxed">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Supporting stat strip */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-zinc-500 uppercase tracking-widest font-semibold">
        <span>&gt; Analyzes 40+ APM sources</span>
        <span className="hidden sm:inline">•</span>
        <span>&gt; Learns from every past incident</span>
      </div>
    </div>
  );
}