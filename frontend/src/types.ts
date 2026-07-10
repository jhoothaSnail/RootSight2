export type ViewState = 'home' | 'dashboard' | 'architecture' | 'runbooks' | 'org' | 'incidents' | 'login' | 'signup';

// GET /api/incidents
export interface IncidentRecord {
  incidentId: string;
  timestamp: string;
  scenario: string;
  rootCause: string;
  rootCauseType: string;
  confidence: number;
  confidenceLabel: string;
  affectedServices: string[];
  affectedTeams: string[];
  explanation: string;
  resolvedBy: string | null;
}

export interface IncidentsResponse {
  incidents: IncidentRecord[];
}

export interface IncidentEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  source?: string;
}

export interface NodeData {
  id: string;
  label: string;
  type: 'service' | 'vendor' | 'team';
  status: 'healthy' | 'warning' | 'critical';
  x: number;
  y: number;
}

export interface EdgeData {
  source: string;
  target: string;
  status: 'healthy' | 'critical';
}

// ─── API Contract Types ─────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// POST /api/upload
export interface UploadSummary {
  services: number;
  vendors: number;
  teams: number;
  engineers: number;
  databases: number;
  incidents: number;
  runbooks: number;
  relationships: number;
}

export interface UploadResponse {
  success: true;
  summary: UploadSummary;
  processingTimeMs?: number;
}

// GET /api/graph
export interface GraphNode {
  id: string;
  type: string;
  name: string;
  category?: string | null;
  status?: HealthStatus;
}

export interface GraphRelationship {
  source: string;
  target: string;
  type: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

// GET /api/node-inspector/:nodeId
export interface NodeInspectorRelatedNode {
  id: string;
  name: string;
  type: string;
  category?: string | null;
}

export interface NodeInspectorNode {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: HealthStatus;
  description: string | null;
  ownerTeam: string | null;
  directDependencies: NodeInspectorRelatedNode[];
  downstreamDependents: NodeInspectorRelatedNode[];
  totalDependencyCount: number;
  relatedVendorsAndDatabases: NodeInspectorRelatedNode[];
  recentIncidentCount: number | null; // null = incident data not present in the uploaded corpus at all
  riskSummary: string;
}

export interface NodeInspectorResponse {
  success: true;
  node: NodeInspectorNode;
}

// POST /api/impact
export interface ImpactedNode {
  id: string;
  name: string;
  type: string;
}

export interface ImpactResponse {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  affectedServices: ImpactedNode[];
  affectedTeams: ImpactedNode[];
  affectedVendors: ImpactedNode[];
  totalAffected: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

// POST /api/simulate
export type SimulatedEventType = 'log' | 'ticket' | 'complaint' | 'alert';

export interface SimulatedEvent {
  id: string;
  type: SimulatedEventType;
  message: string;
  timestamp: string;
  source?: string;
}

export interface SimulateResponse {
  scenario: string;
  incidentId: string;
  events: SimulatedEvent[];
}

// POST /api/analyze
export interface HistoricalMatch {
  incidentId: string;
  date: string;
  summary: string;
  resolver: string;
  team: string;
}

export interface AnalyzeResponse {
  rootCause: string;
  rootCauseType?: string;
  confidence: number;
  confidenceLabel?: string;
  affectedServices: string[];
  affectedVendors?: string[];
  affectedTeams: string[];
  impactRadius?: {
    services: number;
    teams: number;
    vendors: number;
    estimatedUsers: number;
  };
  explanation: string;
  evidence?: string[];
  historicalMatch?: HistoricalMatch | null;
  suggestedRunbook?: string | null;
}

// GET /api/org-intelligence
export interface OrgIntelligenceResponse {
  spof: {
    id: string;
    name: string;
    type: string;
    severity: string;
    dependentServices: string[];
    vendorSla: number;
    description: string;
    title: string;
  };
  ownershipBurden: {
    team: string;
    loadPercent: number;
    loadStatus: string;
    servicesOwned: string[];
  }[];
  keyResponders: {
    id: string;
    name: string;
    team: string;
    status: string;
    references: number;
  }[];
  vendorReliability: {
    id: string;
    name: string;
    uptime: number;
    status: string;
    downtimeMinutes: number;
  }[];
  criticalChains: {
    id: string;
    path: string[];
    risk: string;
    description: string;
  }[];
  recommendations: {
    id: string;
    type: string;
    priority: string;
    message: string;
  }[];
}

// GET /api/runbooks
export interface Runbook {
  id: string;
  title: string;
  trigger: string;
  confidence: number;
  auto: boolean;
  status: string;
  relatedService?: string;
  relatedVendor?: string | null;
  owningTeam?: string;
  actions: string[];
}

export interface RunbooksResponse {
  runbooks: Runbook[];
}

export type RunbookPhase =
  | 'waiting'       // auto: waiting for trigger
  | 'monitoring'    // auto: actively monitoring
  | 'idle'          // manual: ready
  | 'executing'
  | 'success'
  | 'failed'
  | 'manual_pending'; // manual approval required

export interface ExecutionLogEntry {
  time: string;
  message: string;
}

export interface ExecutionRecord {
  runbookId: string;
  status: 'success' | 'failed';
  completedAt: string;
  duration: number;
  logs: ExecutionLogEntry[];
  failedStep?: number;
}

export interface ExecutionLogEntry {
  time: string;
  message: string;
}

export interface ExecutionRecord {
  runbookId: string;
  status: 'success' | 'failed';
  completedAt: string;
  duration: number;
  failedStep?: number;
}

export type ScenarioName = string;