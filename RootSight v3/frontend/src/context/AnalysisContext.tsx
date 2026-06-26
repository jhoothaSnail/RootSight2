import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { AnalyzeResponse, GraphResponse, ScenarioName, SimulatedEvent } from '../types';

// Holds the Analysis Engine state above the view-switching layer so a running /
// completed incident analysis survives navigating between sections instead of
// being reset every time the Dashboard unmounts.

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
  events: SimulatedEvent[];
  setEvents: Dispatch<SetStateAction<SimulatedEvent[]>>;
  analysis: AnalyzeResponse | null;
  setAnalysis: Dispatch<SetStateAction<AnalyzeResponse | null>>;
  phase: RunPhase;
  setPhase: Dispatch<SetStateAction<RunPhase>>;
  runError: string | null;
  setRunError: Dispatch<SetStateAction<string | null>>;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioName>('OAuth Failure');
  const [events, setEvents] = useState<SimulatedEvent[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [runError, setRunError] = useState<string | null>(null);

  return (
    <AnalysisContext.Provider
      value={{
        graph, setGraph,
        graphLoading, setGraphLoading,
        graphError, setGraphError,
        scenario, setScenario,
        events, setEvents,
        analysis, setAnalysis,
        phase, setPhase,
        runError, setRunError,
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
