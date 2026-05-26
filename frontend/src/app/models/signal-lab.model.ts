export interface EngineWindow {
  code: string;
  label: string;
  windowEt: string;
  triggerMode: string;
  activeNow: boolean;
}

export interface SignalHealth {
  ibkrConnected: boolean;
  historicalLoaded: boolean;
  liveStreaming: boolean;
  liveSignalsEnabled: boolean;
  marketStatus: string;
  marketOpen: boolean;
  estTime: string;
  engines: EngineWindow[];
}

export interface OpenMomDebug {
  symbol: string;
  inOpenWindow: boolean;
  score: number;
  scoreLabel: string;
  gapPercent: number | null;
  conditions: Record<string, boolean>;
  reasonChips: string[];
}

export interface OpenScoutDebug {
  symbol: string;
  inScoutWindow: boolean;
  score: number;
  scoreLabel: string;
  gapPercent: number | null;
  estimatedRvol: number | null;
  liveBodyStrength: number | null;
  premarketBreakout: boolean;
  aboveVwap: boolean;
  conditions: Record<string, unknown>;
  reasonChips: string[];
  scoutActive: boolean;
  scoutFailed: boolean;
}

export interface OpenFailDebug {
  symbol: string;
  inOpenFailWindow: boolean;
  score: number;
  scoreLabel: string;
  putSetupLabel: string;
  upperWickPercent: number | null;
  conditions: Record<string, boolean>;
  reasonChips: string[];
  openFail: boolean;
}

export interface MomPullDebug {
  symbol: string;
  inSignalWindow: boolean;
  sessionLabel: string;
  requiredConfidence: number;
  pullScore: number;
  momScore: number;
  pullScoreLabel: string;
  momScoreLabel: string;
  pullReady: boolean;
  pullBuy: boolean;
  momReady: boolean;
  momBuy: boolean;
  pullConditions: Record<string, boolean>;
  momConditions: Record<string, boolean>;
  pullReasonChips: string[];
  momReasonChips: string[];
  pullFailedConditions: string[];
  momFailedConditions: string[];
}

export interface ApiLink {
  label: string;
  path: string;
  description: string;
}
