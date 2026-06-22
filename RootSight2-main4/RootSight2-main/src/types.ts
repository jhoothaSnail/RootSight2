export type ViewState = 'home' | 'ingestion' | 'dashboard' | 'architecture' | 'runbooks' | 'org';

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
