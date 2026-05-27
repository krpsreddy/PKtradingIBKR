import {
  ExecutionLifecycleState,
  ExitAdvisory,
  ExitAdvisoryKind,
  LifecycleHealthTone,
  PostEntryTelemetry
} from './assisted-exit.models';
import { PaperExecutionRecord } from '../../models/paper-execution.model';
import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { scoreExitPressure } from './exit-pressure.engine';
import { scoreContinuationHealth } from './continuation-survival.engine';
import { scorePersistenceHold } from './persistence-hold.engine';
import { detectSecondLegActive } from './second-leg-monitor.engine';

export function buildPostEntryTelemetry(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): PostEntryTelemetry {
  const conv = feed?.conviction ?? record.convictionScore ?? 50;
  const vel = feed?.convictionVelocity ?? 0;
  return {
    persistenceScore: feed ? Math.min(100, feed.persistenceSeconds / 3) : (record.persistenceDurationSec ?? 0) / 3,
    rvolSustainment: feed ? feed.expansionProbability * 100 : 50,
    accelerationDecay: clamp(100 - Math.max(0, -vel * 12), 0, 100),
    vwapIntegrity: feed && /VWAP/i.test(feed.opportunityType) ? feed.triggerIntegrity * 100 : 70,
    pullbackQuality: feed ? Math.max(0, 100 - Math.abs(vel) * 10) : 60,
    secondLegSurvival: detectSecondLegActive(record, feed) ? 85 : 40,
    exhaustionRise: feed?.maturityState === 'EXHAUSTING' ? 80 : feed?.maturityState === 'FAILED' ? 95 : 20,
    convictionDeterioration: clamp(Math.max(0, -vel * 15), 0, 100),
    breadthDeterioration: feed?.tone === 'RED' ? 75 : feed?.tone === 'ORANGE' ? 45 : 15
  };
}

export function resolveLifecycleState(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null,
  exitPressure: number,
  continuationHealth: number
): ExecutionLifecycleState {
  if (feed?.maturityState === 'FAILED' || exitPressure >= 78) return 'FAILED_CONTINUATION';
  if (exitPressure >= 65) return 'EXIT_CRITICAL';
  if (exitPressure >= 48) return 'EXIT_WARNING';
  if (detectSecondLegActive(record, feed)) return 'SECOND_LEG_ACTIVE';
  if (continuationHealth >= 70 && (record.mfeR ?? 0) > 0.006) return 'TRAILING_CONTINUATION';
  if (feed?.maturityState === 'EXHAUSTING' || exitPressure >= 38) return 'REDUCE_RISK';
  if (continuationHealth >= 55) return 'PERSISTING';
  return 'ENTRY_ACTIVE';
}

export function buildExitAdvisories(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null,
  lifecycle: ExecutionLifecycleState,
  telemetry: PostEntryTelemetry,
  exitPressure: number
): ExitAdvisory[] {
  const list: ExitAdvisory[] = [];

  const push = (kind: ExitAdvisoryKind, priority: number, message: string, tone: LifecycleHealthTone) => {
    list.push({ kind, priority, message, tone });
  };

  switch (lifecycle) {
    case 'PERSISTING':
      push('HOLD_PERSISTENCE', 10, 'Persistence intact — hold for continuation monetization', 'GREEN');
      break;
    case 'TRAILING_CONTINUATION':
      push('TRAIL_CONTINUATION', 12, 'Trail mentally with structure; do not tighten prematurely', 'GREEN');
      break;
    case 'SECOND_LEG_ACTIVE':
      push('SECOND_LEG_ACTIVE', 14, 'Second-leg continuation active — consider partial trim only', 'GREEN');
      break;
    case 'REDUCE_RISK':
      push('REDUCE_INTO_EXTENSION', 20, 'Reduce into extension — trim optional, human decides size', 'YELLOW');
      push('EXHAUSTION_RISING', 18, 'Exhaustion rising — monitor closely', 'ORANGE');
      break;
    case 'EXIT_WARNING':
      push('PERSISTENCE_WEAKENING', 25, 'Persistence weakening — prepare manual exit', 'ORANGE');
      break;
    case 'EXIT_CRITICAL':
      push('EXIT_STRUCTURE_FAILURE', 30, 'Structure failure risk — favor manual exit', 'RED');
      break;
    case 'FAILED_CONTINUATION':
      push('EXIT_STRUCTURE_FAILURE', 35, 'Failed continuation — exit advisory critical', 'RED');
      break;
    default:
      push('MONITOR_RISK', 8, 'Entry active — monitor persistence before trim', 'YELLOW');
  }

  if (telemetry.exhaustionRise > 60) {
    push('EXHAUSTION_RISING', 22, 'Exhaustion rising on feed', 'ORANGE');
  }
  if (telemetry.vwapIntegrity < 50 && /VWAP/i.test(record.regime)) {
    push('VWAP_FAILURE_RISK', 24, 'VWAP integrity deteriorating', 'ORANGE');
  }
  if (exitPressure >= 55 && (record.mfeR ?? 0) > 0.008) {
    push('MANUAL_EXIT_READY', 16, 'Favorable MFE — consider taking manual exit if pressure persists', 'YELLOW');
  }

  return list.sort((a, b) => b.priority - a.priority);
}

export function primaryAdvisory(advisories: ExitAdvisory[]): ExitAdvisory {
  return advisories[0] ?? {
    kind: 'MONITOR_RISK',
    priority: 0,
    message: 'Monitoring post-entry lifecycle',
    tone: 'YELLOW'
  };
}

export function healthToneFromLifecycle(state: ExecutionLifecycleState): LifecycleHealthTone {
  switch (state) {
    case 'PERSISTING':
    case 'TRAILING_CONTINUATION':
    case 'SECOND_LEG_ACTIVE':
      return 'GREEN';
    case 'ENTRY_ACTIVE':
    case 'REDUCE_RISK':
      return 'YELLOW';
    case 'EXIT_WARNING':
      return 'ORANGE';
    default:
      return 'RED';
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
