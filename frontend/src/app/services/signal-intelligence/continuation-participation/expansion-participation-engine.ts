import { ContinuationParticipationInput } from './continuation-participation.models';

/** Score expansion participation from structural dimensions (not legacy signal names). */
export class ExpansionParticipationEngine {
  score(input: ContinuationParticipationInput): number {
    let s = 35;
    const rvol = input.rvol ?? 0;
    const vwap = input.vwapDistance ?? 0;
    const trend = input.trendAlignment ?? 0;
    const mins = input.sessionTimeMinutes ?? 999;

    if (rvol >= 2) s += 12;
    if (rvol >= 4) s += 8;
    if (rvol >= 6) s += 6;
    if (vwap >= -0.003 && vwap <= 0.025) s += 14;
    if (Math.abs(vwap) < 0.008) s += 10;
    if (trend >= 55) s += 10;
    if (trend >= 70) s += 6;
    if (!input.extended) s += 10;
    if (mins <= 90) s += 8;
    if (mins <= 45) s += 6;
    if ((input.convictionScore ?? 0) >= 55) s += 8;
    if (input.extended && Math.abs(vwap) > 0.03) s -= 25;
    if (mins > 330) s -= 15;
    return Math.max(0, Math.min(100, s));
  }
}
