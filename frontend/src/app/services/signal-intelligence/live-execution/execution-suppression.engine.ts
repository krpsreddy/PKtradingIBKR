import { EliminationRecommendation } from '../edge-discovery/edge-discovery.models';
import {
  LiveExecutionContext,
  LiveFakeoutRiskLevel,
  OpenTypeSnapshot,
  PremarketExtensionSnapshot,
  SuppressionRule
} from './live-execution.models';
import {
  breadthFromContext,
  extensionPctFromContext,
  normalizeRegime,
  normalizeSetup,
  timeFromContext
} from './live-execution-context.util';

/** Prevents low-quality entries — deterministic suppression rules. */
export class ExecutionSuppressionEngine {

  evaluate(
    ctx: LiveExecutionContext,
    openType: OpenTypeSnapshot,
    premarket: PremarketExtensionSnapshot,
    fakeoutLevel: LiveFakeoutRiskLevel,
    eliminations: EliminationRecommendation[]
  ): SuppressionRule[] {
    const rules: SuppressionRule[] = [];
    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);
    const breadth = breadthFromContext(ctx);
    const ext = extensionPctFromContext(ctx);
    const time = timeFromContext(ctx);

    if (setup === 'INSTITUTIONAL_ACCELERATION' && regime === 'CHOP') {
      rules.push({
        id: 'SUP_BREAKOUT_CHOP',
        label: 'SUPPRESS BREAKOUT + CHOP',
        reason: 'Breakout conditions statistically weak in chop',
        severity: 'SUPPRESS'
      });
    }

    if (setup === 'EARLY_CONTINUATION' && breadth === 'WEAK') {
      rules.push({
        id: 'SUP_MOM_WEAK',
        label: 'SUPPRESS MOMENTUM + WEAK BREADTH',
        reason: 'Momentum without breadth alignment fails frequently',
        severity: 'SUPPRESS'
      });
    }

    if (ext >= 8 && setup === 'EARLY_CONTINUATION' && time.startsWith('9:')) {
      rules.push({
        id: 'SUP_LATE_GAP',
        label: 'SUPPRESS LATE CONTINUATION AFTER >8% GAP',
        reason: 'Overextended premarket gap with elevated trap frequency',
        severity: 'SUPPRESS'
      });
    }

    if (fakeoutLevel === 'HIGH' || fakeoutLevel === 'EXTREME') {
      rules.push({
        id: 'SUP_FAKEOUT',
        label: 'SUPPRESS HIGH FAKEOUT OPEN CONDITIONS',
        reason: `${fakeoutLevel} fakeout risk in current environment`,
        severity: 'SUPPRESS'
      });
    }

    if (openType.openType === 'TRAP_OPEN') {
      rules.push({
        id: 'SUP_TRAP_OPEN',
        label: 'SUPPRESS TRAP OPEN STRUCTURE',
        reason: 'First 15m trap structure detected',
        severity: 'SUPPRESS'
      });
    }

    if (ctx.entryQuality === 'LATE' || ctx.entryQuality === 'CHASE') {
      rules.push({
        id: 'RED_LATE',
        label: 'REDUCE SIZE — LATE ENTRY',
        reason: 'Late/chase entry destroys historical expectancy',
        severity: 'REDUCE'
      });
    }

    for (const e of eliminations.slice(0, 4)) {
      if (this.matchesElimination(e, setup, regime)) {
        rules.push({
          id: e.id,
          label: e.label,
          reason: e.reason,
          severity: e.severity === 'WAIT' ? 'WAIT' : e.severity === 'REDUCE' ? 'REDUCE' : 'SUPPRESS'
        });
      }
    }

    return dedupeRules(rules);
  }

  private matchesElimination(e: EliminationRecommendation, setup: string, regime: string): boolean {
    const label = e.label.toUpperCase();
    if (label.includes(setup.replace('_', ' ')) || label.includes(setup)) return true;
    if (label.includes(regime)) return true;
    return false;
  }
}

function dedupeRules(rules: SuppressionRule[]): SuppressionRule[] {
  const seen = new Set<string>();
  return rules.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
