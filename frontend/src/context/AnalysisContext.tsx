import { createContext, useContext, useState, useCallback, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { AnalyzeResponse, GraphResponse, Runbook, ScenarioName, SimulatedEvent } from '../types';

// Holds all data shared across the workspace sections (Dashboard, Architecture,
// Runbooks) above the view-switching layer, so it survives navigating between
// sections instead of being re-fetched/regenerated every time a section
// unmounts. Each section still owns its own "load if missing" effect — this
// context is just the cache they all read from and write into.
//
// The one place this cache is explicitly cleared is right before a brand new
// document upload replaces the current company's data (see
// IntelligenceWorkspace's call to resetForNewAnalysis) — that's the only
// event that should ever invalidate it, not merely navigating around.

export type RunPhase = 'idle' | 'simulating' | 'analyzing' | 'done';

interface AnalysisState {
  graph: GraphResponse | null;
  setGraph: Dispatch<SetStateAction<GraphResponse | null>>;
  graphLoading: boolean;
  setGraphLoading: Dispatch<SetStateAction<boolean>>;
  graphError: string | null;
  setGraphError: Dispatch<SetStateAction<string | null>>;
  scenario: ScenarioName;
  setScenario: Dispatch<SetStateAction<ScenarioName>>;
  scenarios: string[];
  setScenarios: Dispatch<SetStateAction<string[]>>;
  events: SimulatedEvent[];
  setEvents: Dispatch<SetStateAction<SimulatedEvent[]>>;
  analysis: AnalyzeResponse | null;
  setAnalysis: Dispatch<SetStateAction<AnalyzeResponse | null>>;
  phase: RunPhase;
  setPhase: Dispatch<SetStateAction<RunPhase>>;
  runError: string | null;
  setRunError: Dispatch<SetStateAction<string | null>>;
  runbooks: Runbook[];
  setRunbooks: Dispatch<SetStateAction<Runbook[]>>;
  runbooksError: string | null;
  setRunbooksError: Dispatch<SetStateAction<string | null>>;
  /** Clears every cached value. Call this ONLY when a new upload produces a
   *  new company's graph — never on ordinary navigation. */
  resetForNewAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioName>('OAuth Failure');
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [events, setEvents] = useState<SimulatedEvent[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [runbooksError, setRunbooksError] = useState<string | null>(null);

  const resetForNewAnalysis = useCallback(() => {
    setGraph(null);
    setGraphError(null);
    setScenarios([]);
    setEvents([]);
    setAnalysis(null);
    setPhase('idle');
    setRunError(null);
    setRunbooks([]);
    setRunbooksError(null);
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        graph, setGraph,
        graphLoading, setGraphLoading,
        graphError, setGraphError,
        scenario, setScenario,
        scenarios, setScenarios,
        events, setEvents,
        analysis, setAnalysis,
        phase, setPhase,
        runError, setRunError,
        runbooks, setRunbooks,
        runbooksError, setRunbooksError,
        resetForNewAnalysis,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisState {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within an AnalysisProvider');
  return ctx;
}