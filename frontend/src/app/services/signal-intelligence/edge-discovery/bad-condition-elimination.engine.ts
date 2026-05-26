import { ConditionCluster, EliminationRecommendation } from './edge-discovery.models';

/** Identifies conditions that should suppress or reduce execution — analytics only. */
export class BadConditionEliminationEngine {

  analyze(clusters: ConditionCluster[]): EliminationRecommendation[] {
    const recs: EliminationRecommendation[] = [];

    for (const c of clusters) {
      const m = c.metrics;
      if (c.edgeState === 'TOXIC') {
        recs.push({
          id: `SUP_${c.id}`,
          severity: 'SUPPRESS',
          label: `AVOID ${c.label}`,
          reason: `Toxic cluster — ${m.expectancyR.toFixed(2)}R expectancy, ${m.fakeoutRate}% fakeout`,
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
        continue;
      }
      if (c.edgeState === 'NO_EDGE' || (c.edgeState === 'WEAK_EDGE' && m.expectancyR < -0.1)) {
        recs.push({
          id: `AV_${c.id}`,
          severity: 'AVOID',
          label: `AVOID ${c.label}`,
          reason: `Chronic negative expectancy (${m.expectancyR.toFixed(2)}R, n=${m.sampleCount})`,
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
      }
      if (m.fakeoutRate >= 45 && m.expectancyR <= 0) {
        recs.push({
          id: `FO_${c.id}`,
          severity: 'SUPPRESS',
          label: `SUPPRESS HIGH FAKEOUT — ${c.label}`,
          reason: `${m.fakeoutRate}% false breakout rate in this environment`,
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
      }
      if (c.entryQuality === 'LATE' || c.entryQuality === 'CHASE') {
        if (m.expectancyR < 0 && m.sampleCount >= 5) {
          recs.push({
            id: `LE_${c.id}`,
            severity: 'REDUCE',
            label: `REDUCE SIZE — late entry ${c.label}`,
            reason: 'Late-entry destruction of expectancy',
            clusterId: c.id,
            expectancyR: m.expectancyR,
            sampleCount: m.sampleCount
          });
        }
      }
      if (c.premarketBucket === '>8%' && c.setup === 'EARLY_CONTINUATION' && m.expectancyR < 0) {
        recs.push({
          id: `PM_${c.id}`,
          severity: 'AVOID',
          label: 'AVOID EARLY CONTINUATION AFTER >8% PREMARKET GAP',
          reason: 'Overextended early continuation with negative expectancy',
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
      }
      if (c.regime === 'CHOP' && c.setup === 'INSTITUTIONAL_ACCELERATION' && m.expectancyR < 0) {
        recs.push({
          id: `BC_${c.id}`,
          severity: 'SUPPRESS',
          label: 'AVOID INSTITUTIONAL ACCELERATION IN CHOP',
          reason: 'Acceleration edge collapses in chop regime',
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
      }
      if (c.rvolBucket === '>5' && c.entryQuality === 'CHASE') {
        recs.push({
          id: `RC_${c.id}`,
          severity: 'SUPPRESS',
          label: 'SUPPRESS HIGH RVOL CHASE ENTRIES',
          reason: 'Chase entries at extreme RVOL underperform',
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
      }
      if (c.timeWindow === '10:15–11:00' && c.regime === 'CHOP' && m.expectancyR < -0.05) {
        recs.push({
          id: `MC_${c.id}`,
          severity: 'REDUCE',
          label: 'REDUCE SIZE DURING MIDDAY CHOP',
          reason: 'Mid-session chop destroys continuation',
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
      }
      if (c.setup === 'VWAP_PERSISTENCE' && c.edgeState === 'HIGH_EDGE') {
        recs.push({
          id: `WR_${c.id}`,
          severity: 'WAIT',
          label: 'WAIT FOR RECLAIM CONFIRMATION',
          reason: 'Positive edge exists but requires confirmation discipline',
          clusterId: c.id,
          expectancyR: m.expectancyR,
          sampleCount: m.sampleCount
        });
      }
    }

    const byId = new Map<string, EliminationRecommendation>();
    for (const r of recs) {
      if (!byId.has(r.label)) byId.set(r.label, r);
    }
    return [...byId.values()]
      .sort((a, b) => a.expectancyR - b.expectancyR)
      .slice(0, 15);
  }
}
