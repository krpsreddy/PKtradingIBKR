export type BrokerMode = 'PAPER' | 'LIVE';

export interface BrokerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  clientId: number;
  mode: BrokerMode;
  enabled: boolean;
  autoReconnect: boolean;
  adapterType: string;
}

export interface BrokerConnectionStatus {
  status: string;
  phase: string;
  mode: string;
  profile: string;
  profileId: string;
  host: string;
  port: number;
  clientId: number;
  connected: boolean;
  ready: boolean;
  streaming: boolean;
  latencyMs: number | null;
  subscriptionCount: number;
  message: string | null;
  updatedAt: number;
}

export interface BrokerEventPayload {
  event: string;
  status: BrokerConnectionStatus;
  timestamp: number;
}
