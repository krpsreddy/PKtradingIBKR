import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';

/** Phase 169 — 1s lightweight client-side nano scan prioritization (no heavy replay). */
export interface NanoScanSignal {
  symbol: string;
  priceDelta: number;
  rvolAcceleration: number;
  vwapReclaim: boolean;
  microCompression: number;
  spreadTightening: number;
  continuationVelocity: number;
  tapeImbalance: number;
  persistenceTimer: number;
  pullbackDepth: number;
}

export interface NanoScanResult {
  symbol: string;
  nanoStage: 'DEVELOPING' | 'CONFIRMING' | 'CONFIRMED';
  convictionVelocity: number;
  popVelocity: number;
  opportunityAge: number;
  scannerPriority: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Lightweight nano evaluation — allowed inputs only, no historical recomputation. */
export function evaluateNanoScan(signal: NanoScanSignal): NanoScanResult {
  const momentum =
    Math.abs(signal.priceDelta) * 8 +
    signal.rvolAcceleration * 0.35 +
    signal.continuationVelocity * 0.4 +
    (signal.vwapReclaim ? 12 : 0) +
    signal.microCompression * 0.15 +
    signal.spreadTightening * 0.2 +
    signal.tapeImbalance * 0.25 -
    signal.pullbackDepth * 0.3;

  const popVelocity = clamp(Math.round(momentum * 0.6));
  const convictionVelocity = clamp(Math.round(popVelocity * 0.85 + signal.persistenceTimer * 0.4));

  let nanoStage: NanoScanResult['nanoStage'] = 'DEVELOPING';
  if (signal.persistenceTimer >= 8 && momentum >= 35) nanoStage = 'CONFIRMING';
  if (signal.persistenceTimer >= 15 && momentum >= 55 && signal.vwapReclaim) nanoStage = 'CONFIRMED';

  const scannerPriority = convictionVelocity * 1.5 + popVelocity + signal.persistenceTimer;

  return {
    symbol: signal.symbol,
    nanoStage,
    convictionVelocity,
    popVelocity,
    opportunityAge: signal.persistenceTimer,
    scannerPriority
  };
}

/** Merge nano priority boost into feed items for reprioritization. */
export function applyNanoBoost(items: ExecutionFeedItem[], boosts: Map<string, NanoScanResult>): ExecutionFeedItem[] {
  return [...items]
    .map(item => {
      const boost = boosts.get(item.symbol);
      if (!boost) return item;
      return {
        ...item,
        convictionVelocity: Math.max(item.convictionVelocity, boost.convictionVelocity)
      };
    })
    .sort((a, b) => {
      const ba = boosts.get(a.symbol);
      const bb = boosts.get(b.symbol);
      const pa = a.conviction + Math.max(0, a.convictionVelocity) * 1.5 + (ba?.scannerPriority ?? 0) * 0.05;
      const pb = b.conviction + Math.max(0, b.convictionVelocity) * 1.5 + (bb?.scannerPriority ?? 0) * 0.05;
      return pb - pa;
    });
}
