import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { confidenceFromCount, evaluatedSignals } from '../signal-intelligence.math';
import { ExecutionEntryClassificationEngine } from './execution-entry-classification.engine';
import { ExecutionQualityExpectancyEngine } from './execution-quality-expectancy.engine';
import { GoodVsBadChaseEngine } from './good-vs-bad-chase.engine';
import { ReclaimQualityEngine } from './reclaim-quality.engine';
import { ExecutionMissedWinnerAnalysisEngine } from './missed-winner-analysis.engine';
import {
  ExecutionEntryClassification,
  ExecutionQualityReport,
  ExecutionQualitySynthesisLine,
  LiveExecutionQualityInput,
  LiveExecutionQualityIntel
} from './execution-quality.models';
import { extensionPct, MIN_AUTHORITATIVE_SAMPLE, MIN_LOW_CONFIDENCE_SAMPLE } from './execution-quality.util';

/** Phase 141 orchestrator — execution quality classification & synthesis (advisory only). */
@Injectable({ providedIn: 'root' })
export class ExecutionQualitySynthesisService {
  private readonly classifier = new ExecutionEntryClassificationEngine();
  private readonly expectancyEngine = new ExecutionQualityExpectancyEngine();
  private readonly chaseEngine = new GoodVsBadChaseEngine();
  private readonly reclaimEngine = new ReclaimQualityEngine();
  private readonly missedEngine = new ExecutionMissedWinnerAnalysisEngine();

  private readonly reportSubject = new BehaviorSubject<ExecutionQualityReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
  }

  snapshot(): ExecutionQualityReport | null {
    return this.reportSubject.value;
  }

  refresh(filter: SignalIntelligenceFilter = {}): ExecutionQualityReport {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildReport(signals, lookbackDays);
  }

  liveIntel(input: LiveExecutionQualityInput): LiveExecutionQualityIntel {
    const fromTs = Date.now() - SIGNAL_INTELLIGENCE_LOOKBACK_DAYS * 86_400_000;
    const historical = this.store.query({ symbol: input.symbol.toUpperCase(), fromTs });
    const evaluated = evaluatedSignals(historical);
    const report = this.snapshot() ?? this.refresh({ symbol: input.symbol });

    const classification = this.classifier.classifyLive(input, evaluated.length);
    const liveSnapshot = this.classifier.buildLiveSnapshot(input);
    const chaseSub = classification.classification === 'CHASE' || classification.classification === 'EXTENDED'
      ? this.chaseEngine.subType(liveSnapshot)
      : null;

    const ext = Math.abs(input.vwapDistance ?? 0) * 100;
    const fakeoutRisk = this.fakeoutRisk(classification.classification, report);
    const continuationLabel = this.continuationLabel(classification.classification, report);
    const compactLine = this.compactLine(classification.classification, chaseSub, ext, fakeoutRisk, continuationLabel);
    const governanceHint = this.governanceHint(classification.classification, chaseSub, fakeoutRisk);

    return {
      classification: classification.classification,
      chaseSubType: chaseSub,
      compactLine,
      detailLines: classification.rationale,
      fakeoutRisk,
      continuationLabel,
      governanceHint,
      authoritative: evaluated.length >= MIN_AUTHORITATIVE_SAMPLE,
      advisoryOnly: true
    };
  }

  private buildReport(signals: ReturnType<SignalIntelligenceStore['query']>, lookbackDays: number): ExecutionQualityReport {
    const evaluated = evaluatedSignals(signals);
    const expectancy = this.expectancyEngine.analyze(signals);
    const goodVsBadChase = this.chaseEngine.analyze(signals);
    const reclaimQuality = this.reclaimEngine.analyze(signals);
    const missedWinners = this.missedEngine.analyze(signals);
    const synthesis = this.synthesize(expectancy, goodVsBadChase, reclaimQuality, evaluated.length);

    const report: ExecutionQualityReport = {
      lookbackDays,
      totalEvaluated: evaluated.length,
      generatedAt: Date.now(),
      expectancy,
      matrix: expectancy.matrix,
      goodVsBadChase,
      reclaimQuality,
      missedWinners,
      synthesis,
      advisoryOnly: true
    };

    this.reportSubject.next(report);
    return report;
  }

  private synthesize(
    expectancy: ReturnType<ExecutionQualityExpectancyEngine['analyze']>,
    chase: ReturnType<GoodVsBadChaseEngine['analyze']>,
    reclaim: ReturnType<ReclaimQualityEngine['analyze']>,
    totalEvaluated: number
  ): ExecutionQualitySynthesisLine[] {
    const lines: ExecutionQualitySynthesisLine[] = [];
    const conf = confidenceFromCount(totalEvaluated);

    const ideal = expectancy.byClassification.find(r => r.classification === 'IDEAL');
    const reclaimConf = expectancy.byClassification.find(r => r.classification === 'RECLAIM_CONFIRMED');
    const momentumRows = expectancy.matrix.filter(r => r.setup === 'MOMENTUM' && r.sampleCount >= MIN_AUTHORITATIVE_SAMPLE);

    if (reclaimConf && reclaimConf.sampleCount >= MIN_AUTHORITATIVE_SAMPLE && reclaimConf.expectancyR > 0.1) {
      lines.push({
        id: 'reclaim-edge',
        headline: 'Momentum is profitable ONLY when reclaim-confirmed.',
        detail: `Reclaim-confirmed expectancy ${fmtR(reclaimConf.expectancyR)} (n=${reclaimConf.sampleCount})`,
        confidence: reclaimConf.confidence
      });
    }

    const badChase = chase.bad;
    if (badChase.sampleCount >= MIN_AUTHORITATIVE_SAMPLE && badChase.expectancyR < -0.15) {
      const extBucket = reclaim.extensionBuckets.find(b => b.bucket === '>8%');
      const extNote = extBucket && extBucket.sampleCount >= 5 ? '8%' : '5%';
      lines.push({
        id: 'chase-toxic',
        headline: `Chase entries become toxic above ${extNote} extension.`,
        detail: `Bad chase expectancy ${fmtR(badChase.expectancyR)} · fakeout ${badChase.fakeoutRate}%`,
        confidence: conf
      });
    }

    const goodChase = chase.good;
    if (goodChase.sampleCount >= MIN_LOW_CONFIDENCE_SAMPLE && goodChase.expectancyR > 0.15) {
      lines.push({
        id: 'good-chase',
        headline: 'Trend continuation performs well despite chase characteristics when breadth is strong.',
        detail: `Good chase expectancy ${fmtR(goodChase.expectancyR)} · continuation ${goodChase.continuationSuccess}%`,
        confidence: conf
      });
    }

    const weakCont = momentumRows.find(r => r.regime === 'CHOP' && r.expectancyR < 0);
    if (weakCont) {
      lines.push({
        id: 'weak-breadth',
        headline: 'Weak breadth continuation is consistently negative.',
        detail: `MOMENTUM × CHOP expectancy ${fmtR(weakCont.expectancyR)} (n=${weakCont.sampleCount})`,
        confidence: weakCont.confidence
      });
    }

    if (ideal && ideal.sampleCount >= MIN_AUTHORITATIVE_SAMPLE) {
      lines.push({
        id: 'ideal-edge',
        headline: `IDEAL entries deliver ${fmtR(ideal.expectancyR)} with ${ideal.winRate}% WR.`,
        detail: `Fakeout ${ideal.fakeoutRate}% · continuation ${ideal.continuationSuccess}%`,
        confidence: ideal.confidence
      });
    }

    if (reclaim.sampleCount >= MIN_AUTHORITATIVE_SAMPLE && reclaim.holdRate >= 55) {
      lines.push({
        id: 'reclaim-hold',
        headline: `Reclaim hold rate ${reclaim.holdRate}% — wait for acceptance confirmation.`,
        detail: `Reclaim expectancy ${fmtR(reclaim.expectancyR)} · fakeout ${reclaim.fakeoutRate}%`,
        confidence: conf
      });
    }

    return lines.slice(0, 8);
  }

  private compactLine(
    classification: ExecutionEntryClassification,
    chaseSub: ReturnType<GoodVsBadChaseEngine['subType']> | null,
    extPct: number,
    fakeout: 'LOW' | 'MEDIUM' | 'HIGH',
    continuation: string
  ): string {
    const fake = fakeout === 'LOW' ? 'LOW FAKEOUT' : fakeout === 'HIGH' ? 'HIGH FAKEOUT' : 'MOD FAKEOUT';
    const ext = extPct >= 5 ? ` · EXTENDED ${extPct.toFixed(0)}%` : '';

    switch (classification) {
      case 'IDEAL':
      case 'RECLAIM_CONFIRMED':
        return `${classification.replace(/_/g, ' ')} · ${fake} · FULL EDGE`;
      case 'ACCEPTABLE':
        return `ACCEPTABLE CONTINUATION · WAIT FOR HOLD · ${fake}`;
      case 'EARLY_PROBE':
        return `EARLY PROBE · WAIT FOR CONFIRMATION · ${fake}`;
      case 'CHASE':
        if (chaseSub === 'GOOD_CHASE') return `GOOD CHASE · ${continuation} · ${fake}`;
        return `CHASE RISK${ext} · REDUCE SIZE · ${fake}`;
      case 'EXTENDED':
        return `EXTENDED ENTRY${ext} · REDUCE SIZE · ${fake}`;
      case 'EXHAUSTED':
        return `EXHAUSTION RISK · THIRD LEG EXTENDED · ${fake}`;
      case 'TRAP_RISK':
        return `TRAP RISK · WEAK BREADTH · ${fake}`;
      case 'LIQUIDITY_SWEEP_RISK':
        return `SWEEP RISK · STOP-HUNT PROFILE · ${fake}`;
    }
  }

  private fakeoutRisk(
    classification: ExecutionEntryClassification,
    report: ExecutionQualityReport
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const row = report.expectancy.byClassification.find(r => r.classification === classification);
    if (!row) return classification.includes('TRAP') || classification.includes('SWEEP') ? 'HIGH' : 'MEDIUM';
    if (row.fakeoutRate >= 45) return 'HIGH';
    if (row.fakeoutRate >= 25) return 'MEDIUM';
    return 'LOW';
  }

  private continuationLabel(classification: ExecutionEntryClassification, report: ExecutionQualityReport): string {
    const row = report.expectancy.byClassification.find(r => r.classification === classification);
    if (!row) return 'MOD CONT';
    if (row.continuationSuccess >= 55) return 'STRONG CONT';
    if (row.continuationSuccess >= 40) return 'MOD CONT';
    return 'WEAK CONT';
  }

  private governanceHint(
    classification: ExecutionEntryClassification,
    chaseSub: ReturnType<GoodVsBadChaseEngine['subType']> | null,
    fakeout: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string {
    if (classification === 'IDEAL' || classification === 'RECLAIM_CONFIRMED') return 'Full size eligible with governance approval';
    if (classification === 'ACCEPTABLE' || classification === 'EARLY_PROBE') return 'Wait for hold confirmation before sizing up';
    if (classification === 'CHASE' && chaseSub === 'GOOD_CHASE') return 'Reduced size — professional continuation chase';
    if (fakeout === 'HIGH' || classification.includes('TRAP') || classification === 'EXHAUSTED') return 'Suppress or minimal size — human approval required';
    return 'Reduce size — execution quality suboptimal';
  }
}

function fmtR(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
}
