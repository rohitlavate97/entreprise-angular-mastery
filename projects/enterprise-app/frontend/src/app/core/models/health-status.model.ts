export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  service: string;
  version: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
