import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ChevronDown, ChevronUp, User, Clock, Activity } from 'lucide-react';
import type { IncidentRecord } from '../types';
import { getIncidents, ApiClientError } from '../api/client';
import { LoadingState, ErrorState, EmptyState } from './States';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function confidenceColor(label: string) {
  switch (label) {
    case 'High':   return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'Medium': return 'text-amber-400   bg-amber-500/10   border-amber-500/30';
    default:       return 'text-red-400     bg-red-500/10     border-red-500/30';
  }
}

function typeColor(type: string) {
  switch (type) {
    case 'Vendor':   return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
    case 'Database': return 'text-sky-400    bg-sky-500/10    border-sky-500/20';
    default:         return 'text-amber-400  bg-amber-500/10  border-amber-500/20';
  }
}

// ─── Incident Row ──────────────────────────────────────────────────────────────

function IncidentRow({ incident, index }: { incident: IncidentRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40"
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-800/40 transition-colors text-left"
      >
        {/* Incident ID */}
        <span className="font-mono text-xs text-amber-500 w-16 shrink-0">{incident.incidentId}</span>

        {/* Root cause */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-sm font-medium text-zinc-100 truncate">{incident.rootCause}</span>
          <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${typeColor(incident.rootCauseType)}`}>
            {incident.rootCauseType}
          </span>
        </div>

        {/* Confidence */}
        <span className={`shrink-0 text-xs font-mono px-2 py-0.5 rounded border ${confidenceColor(incident.confidenceLabel)}`}>
          {incident.confidence}% {incident.confidenceLabel}
        </span>

        {/* Timestamp */}
        <span className="shrink-0 text-xs text-zinc-500 font-mono hidden md:block w-36 text-right">
          {formatDate(incident.timestamp)}
        </span>

        {/* Chevron */}
        <div className="shrink-0 text-zinc-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-zinc-800 space-y-3">

              {/* Explanation */}
              <p className="text-sm text-zinc-300 leading-relaxed">{incident.explanation}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Affected services */}
                {incident.affectedServices.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1.5">
                      <Activity className="w-3 h-3" /> Affected Services
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.affectedServices.map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta row */}
                <div className="space-y-1.5">
                  {incident.affectedTeams.length > 0 && (
                    <p className="text-xs text-zinc-400 font-mono">
                      <span className="text-zinc-600">Teams: </span>
                      {incident.affectedTeams.join(', ')}
                    </p>
                  )}
                  {incident.resolvedBy && (
                    <p className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
                      <User className="w-3 h-3 text-zinc-600" />
                      <span className="text-zinc-600">Resolved by: </span>
                      {incident.resolvedBy}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 font-mono flex items-center gap-1.5 md:hidden">
                    <Clock className="w-3 h-3" />{formatDate(incident.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export default function IncidentHistory() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<{ message: string; code?: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getIncidents();
      setIncidents(data.incidents);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError({ message: err.message, code: err.code });
      } else {
        setError({ message: 'Could not load incident history.' });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-zinc-900 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold text-white tracking-tight">Incident History</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5 uppercase tracking-widest">
            {loading ? 'Loading…' : `${incidents.length} incident${incidents.length !== 1 ? 's' : ''} on record`}
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading && <LoadingState label="Loading incident history…" />}
        {!loading && error && (
          <ErrorState message={error.message} code={error.code} onRetry={load} />
        )}
        {!loading && !error && incidents.length === 0 && (
          <EmptyState label="No incidents recorded yet. Run an analysis to populate history." />
        )}
        {!loading && !error && incidents.map((inc, i) => (
          <IncidentRow key={inc.incidentId} incident={inc} index={i} />
        ))}
      </div>
    </div>
  );
}
