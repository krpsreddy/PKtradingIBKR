export interface SystemStatus {
  ibkrConnected: boolean;
  historicalLoaded: boolean;
  liveStreaming: boolean;
  marketOpen: boolean;
  marketStatus: string;
  symbol?: string;
  livePrice?: number | null;
  lastUpdate?: string;
}

export interface DebugPanel {
  lastCandleTime?: string | null;
  lastCandleClose?: number | null;
  lastCandleVolume?: number | null;
  latestIndicators?: string;
  latestSignalReason?: string;
  lastSignalType?: string | null;
  connectionLogs: string[];
}
