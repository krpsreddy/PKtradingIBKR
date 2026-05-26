import {
  ConditionCluster,
  EdgeDiscoverySnapshot,
  HeatmapCell
} from './edge-discovery.models';
import { MarketRegime, SignalSnapshot } from '../../../models/signal-intelligence.model';
import { AutonomousOpportunityType } from '../../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { evaluatedSignals } from '../signal-intelligence.math';
import {
  AUTONOMOUS_OPPORTUNITY_TYPES,
  formatAutonomousOpportunityType,
  resolveAutonomousOpportunityType
} from '../../../utils/autonomous-terminology.util';
import {
  breadthBucket,
  classifyEdgeState,
  computeAdaptiveEdgeScore,
  computeClusterMetrics,
  edgeScoreBand,
  entryQuality,
  heatmapTone,
  MIN_CLUSTER_SAMPLE,
  premarketBucket,
  rvolBucket,
  timeWindow
} from './edge-cluster-metrics.util';

const SETUPS = AUTONOMOUS_OPPORTUNITY_TYPES;
const REGIMES: MarketRegime[] = ['TREND', 'CHOP', 'BREAKOUT', 'CALM', 'EXITING'];
const RVOLS = ['<1.5', '1.5–3', '3–5', '>5'];
const TIMES = ['9:30–9:45', '9:45–10:15', '10:15–11:00', '11:00+'];
const PREMARKET = ['<2%', '2–5%', '5–8%', '>8%'];
const ENTRIES = ['IDEAL', 'GOOD', 'LATE', 'CHASE'];
const BREADTH = ['WEAK', 'MID', 'STRONG'];

function matchesSetup(s: SignalSnapshot, setup: AutonomousOpportunityType): boolean {
  return resolveAutonomousOpportunityType(s) === setup;
}

/** Discovers profitable and destructive condition clusters from evaluated signals. */
export class EdgeDiscoveryEngine {

  discover(signals: SignalSnapshot[], lookbackDays = 60): EdgeDiscoverySnapshot {
    const evaluated = evaluatedSignals(signals);
    const clusters = this.buildClusters(signals);
    const sorted = [...clusters].sort((a, b) => b.metrics.expectancyR - a.metrics.expectancyR);

    return {
      lookbackDays,
      totalEvaluated: evaluated.length,
      clusters: sorted,
      highEdge: sorted.filter(c => c.edgeState === 'HIGH_EDGE' || c.edgeState === 'MODERATE_EDGE').slice(0, 12),
      toxic: sorted.filter(c => c.edgeState === 'TOXIC').slice(0, 12),
      noEdge: sorted.filter(c => c.edgeState === 'NO_EDGE' || c.edgeState === 'WEAK_EDGE').slice(0, 12),
      heatmapRegime: this.heatmap(signals, REGIMES, (s, d) => s.marketRegime === d),
      heatmapRvol: this.heatmap(signals, RVOLS, (s, d) => rvolBucket(s.rvol ?? 0) === d),
      heatmapTime: this.heatmap(signals, TIMES, (s, d) => timeWindow(s.sessionTimeMinutes ?? 0) === d),
      heatmapBreadth: this.heatmap(signals, BREADTH, (s, d) => breadthBucket(s) === d),
      computedAt: Date.now()
    };
  }

  private buildClusters(signals: SignalSnapshot[]): ConditionCluster[] {
    const out: ConditionCluster[] = [];
    const seen = new Set<string>();

    for (const setup of SETUPS) {
      for (const regime of REGIMES) {
        this.addCluster(out, seen, signals, { setup, regime });
        for (const rb of RVOLS) {
          this.addCluster(out, seen, signals, { setup, regime, rvolBucket: rb },
            s => matchesSetup(s, setup) && s.marketRegime === regime && rvolBucket(s.rvol ?? 0) === rb);
        }
        for (const tw of TIMES) {
          this.addCluster(out, seen, signals, { setup, regime, timeWindow: tw },
            s => matchesSetup(s, setup) && s.marketRegime === regime && timeWindow(s.sessionTimeMinutes ?? 0) === tw);
        }
        for (const br of BREADTH) {
          this.addCluster(out, seen, signals, { setup, regime, breadthBucket: br },
            s => matchesSetup(s, setup) && s.marketRegime === regime && breadthBucket(s) === br);
        }
      }
      for (const rb of RVOLS) {
        this.addCluster(out, seen, signals, { setup, rvolBucket: rb },
          s => matchesSetup(s, setup) && rvolBucket(s.rvol ?? 0) === rb);
      }
      for (const pm of PREMARKET) {
        this.addCluster(out, seen, signals, { setup, premarketBucket: pm },
          s => matchesSetup(s, setup) && premarketBucket(s) === pm);
      }
      for (const eq of ENTRIES) {
        this.addCluster(out, seen, signals, { setup, entryQuality: eq },
          s => matchesSetup(s, setup) && entryQuality(s) === eq);
      }
    }

    return out;
  }

  private addCluster(
    out: ConditionCluster[],
    seen: Set<string>,
    signals: SignalSnapshot[],
    dims: Partial<ConditionCluster> & { setup: AutonomousOpportunityType },
    filter?: (s: SignalSnapshot) => boolean
  ): void {
    const bucket = filter
      ? signals.filter(filter)
      : signals.filter(s => matchesSetup(s, dims.setup) && (!dims.regime || s.marketRegime === dims.regime));
    const metrics = computeClusterMetrics(bucket);
    if (metrics.sampleCount < MIN_CLUSTER_SAMPLE) return;

    const label = buildLabel(dims);
    const id = label.replace(/\s+/g, '_').toUpperCase();
    if (seen.has(id)) return;
    seen.add(id);

    const edgeScore = computeAdaptiveEdgeScore(metrics);
    out.push({
      id,
      label,
      setup: dims.setup,
      regime: dims.regime,
      rvolBucket: dims.rvolBucket,
      timeWindow: dims.timeWindow,
      premarketBucket: dims.premarketBucket,
      entryQuality: dims.entryQuality,
      breadthBucket: dims.breadthBucket,
      metrics,
      edgeState: classifyEdgeState(metrics),
      edgeScore,
      edgeScoreBand: edgeScoreBand(edgeScore)
    });
  }

  private heatmap(
    signals: SignalSnapshot[],
    dims: string[],
    match: (s: SignalSnapshot, d: string) => boolean
  ): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    for (const setup of SETUPS) {
      for (const d of dims) {
        const bucket = signals.filter(s => matchesSetup(s, setup) && match(s, d));
        const m = computeClusterMetrics(bucket);
        cells.push({
          setup,
          dimension: d,
          sampleCount: m.sampleCount,
          expectancyR: m.expectancyR,
          winRate: m.winRate,
          tone: heatmapTone(m.sampleCount, m.expectancyR, m.winRate)
        });
      }
    }
    return cells;
  }
}

function buildLabel(d: Partial<ConditionCluster> & { setup: AutonomousOpportunityType }): string {
  const parts = [formatAutonomousOpportunityType(d.setup)];
  if (d.regime) parts.push(d.regime);
  if (d.rvolBucket) parts.push(`RVOL ${d.rvolBucket}`);
  if (d.timeWindow) parts.push(d.timeWindow);
  if (d.premarketBucket) parts.push(`PM ${d.premarketBucket}`);
  if (d.entryQuality) parts.push(d.entryQuality);
  if (d.breadthBucket) parts.push(`${d.breadthBucket} breadth`);
  return parts.join(' + ');
}
