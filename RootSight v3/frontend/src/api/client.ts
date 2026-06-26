// ─── RootSight API Client ───────────────────────────────────────────────────────
//
// Thin typed wrapper over the backend REST API. Every call targets the live
// server first and transparently falls back to the local contract mocks when the
// server is unreachable (network-level failure only). Legitimate API error
// responses (structured { success:false, error:{ code, message } }) are surfaced
// to the caller so the UI can show meaningful messages.
//
// Configuration (Vite env):
//   VITE_API_BASE_URL  - override API origin (default: '' -> dev proxy at /api)
//   VITE_USE_MOCKS     - 'true' forces offline mock mode

import type {
  AnalyzeResponse,
  GraphResponse,
  OrgIntelligenceResponse,
  RunbooksResponse,
  SimulateResponse,
  UploadResponse,
} from '../types';
import { SCENARIOS } from '../data/scenarios';

import graphMock from '../../../shared/mocks/graph-success.json';
import orgMock from '../../../shared/mocks/org-intelligence-success.json';
import runbooksMock from '../../../shared/mocks/runbooks-success.json';
import uploadMock from '../../../shared/mocks/upload-success.json';

const BASE: string = import.meta.env.VITE_API_BASE_URL ?? '';
const FORCE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === 'true';

/** Server responded with a structured error envelope. Surfaced to the UI. */
export class ApiClientError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
  }
}

/** Server could not be reached / returned a non-JSON response. Triggers fallback. */
class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new NetworkError(`Could not reach ${path}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    // Non-JSON (e.g. dev proxy 500 or SPA fallback HTML) -> treat as unreachable.
    throw new NetworkError(`Invalid response from ${path}`);
  }

  if (!res.ok || data?.success === false) {
    throw new ApiClientError(
      data?.error?.message || 'The request could not be completed.',
      data?.error?.code || 'REQUEST_FAILED'
    );
  }
  return data as T;
}

async function withFallback<T>(live: () => Promise<T>, mock: () => T): Promise<T> {
  if (FORCE_MOCKS) return mock();
  try {
    return await live();
  } catch (err) {
    if (err instanceof NetworkError) {
      console.warn('[api] server unreachable, using offline mock:', err.message);
      return mock();
    }
    throw err;
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' };

// ─── Endpoints ──────────────────────────────────────────────────────────────────

export interface UploadFile {
  field: string;
  file: File;
}

export function uploadDocuments(files: UploadFile[]): Promise<UploadResponse> {
  const form = new FormData();
  for (const { field, file } of files) {
    form.append(field, file, file.name);
  }
  return withFallback<UploadResponse>(
    () => apiFetch<UploadResponse>('/api/upload', { method: 'POST', body: form }),
    () => uploadMock as UploadResponse
  );
}

export function getGraph(): Promise<GraphResponse> {
  return withFallback<GraphResponse>(
    () => apiFetch<GraphResponse>('/api/graph'),
    () => graphMock as GraphResponse
  );
}

export function simulate(scenario: string): Promise<SimulateResponse> {
  return withFallback<SimulateResponse>(
    () =>
      apiFetch<SimulateResponse>('/api/simulate', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ scenario }),
      }),
    () => {
      const fixture = (SCENARIOS as Record<string, { simulate: SimulateResponse }>)[scenario];
      if (!fixture) throw new ApiClientError(`Unknown scenario: ${scenario}`, 'SCENARIO_NOT_FOUND');
      return fixture.simulate;
    }
  );
}

export function analyze(events: unknown[], scenario?: string): Promise<AnalyzeResponse> {
  return withFallback<AnalyzeResponse>(
    () =>
      apiFetch<AnalyzeResponse>('/api/analyze', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ events, scenario }),
      }),
    () => {
      const fixture = scenario
        ? (SCENARIOS as Record<string, { analyze: AnalyzeResponse }>)[scenario]
        : undefined;
      if (fixture) return fixture.analyze;
      return SCENARIOS['OAuth Failure'].analyze;
    }
  );
}

export function getOrgIntelligence(): Promise<OrgIntelligenceResponse> {
  return withFallback<OrgIntelligenceResponse>(
    () => apiFetch<OrgIntelligenceResponse>('/api/org-intelligence'),
    () => orgMock as OrgIntelligenceResponse
  );
}

export function getRunbooks(): Promise<RunbooksResponse> {
  return withFallback<RunbooksResponse>(
    () => apiFetch<RunbooksResponse>('/api/runbooks'),
    () => runbooksMock as RunbooksResponse
  );
}
