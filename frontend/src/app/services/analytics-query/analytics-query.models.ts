/** Phase 156 — Analytics Query Workbench models. */

export interface BandMetrics {
  count: number;
  avgR: number;
  winRate: number;
  fakeoutRate: number;
  continuationRate: number;
  avgConviction: number;
}

export interface ConvictionDistribution {
  elite: BandMetrics;
  high: BandMetrics;
  moderate: BandMetrics;
  low: BandMetrics;
  avoid: BandMetrics;
  totalRows: number;
  histogramBuckets: number;
}

export interface GroupStat {
  group: string;
  count: number;
  avgR: number;
  winRate: number;
  fakeoutRate: number;
  continuationRate: number;
  avgConviction: number;
  fullExecutionRate: number;
}

export interface CrossMatrixCell {
  decision: string;
  narrative: string;
  count: number;
  avgR: number;
  winRate: number;
  fakeoutRate: number;
  continuationRate: number;
  avgConviction: number;
}

export interface CrossMatrix {
  cells: CrossMatrixCell[];
  totalRows: number;
}

export interface DiagnosticsInsight {
  id: string;
  question: string;
  answer: string;
  severity: 'OK' | 'WARN' | 'INFO';
  metrics: Record<string, unknown>;
}

export interface DiagnosticsSummary {
  insights: DiagnosticsInsight[];
  totalSnapshots: number;
  analyticsVersion: number;
  generatedAt: number;
}

export interface AnalyticsWorkbench {
  convictionDistribution: ConvictionDistribution;
  decisionStats: GroupStat[];
  narrativeStats: GroupStat[];
  qualityStats: GroupStat[];
  resultStats: GroupStat[];
  crossMatrix: CrossMatrix;
  diagnostics: DiagnosticsSummary;
  totalRows: number;
  generatedAt: number;
}

export interface AnalyticsQueryFilters {
  symbol?: string;
  from?: string;
  to?: string;
  decision?: string;
  narrative?: string;
  quality?: string;
  result?: string;
  convictionBand?: string;
}

export const CONVICTION_BANDS = [
  { id: 'ELITE', label: 'Elite 90–100', min: 90 },
  { id: 'HIGH', label: 'High 75–89', min: 75 },
  { id: 'MODERATE', label: 'Moderate 55–74', min: 55 },
  { id: 'LOW', label: 'Low 35–54', min: 35 },
  { id: 'AVOID', label: 'Avoid 0–34', min: 0 }
] as const;
