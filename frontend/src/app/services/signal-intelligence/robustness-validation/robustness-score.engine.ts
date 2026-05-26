import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  RobustnessClassification,
  StrategyValidationMetrics
} from './robustness-validation.models';
import { RegimeValidationEngine } from './regime-validation.engine';
import { SymbolGeneralizationEngine } from './symbol-generalization.engine';
import { VolatilityRobustnessEngine } from './volatility-robustness.engine';
import { MarketPhaseValidationEngine } from './market-phase-validation.engine';
import { ContinuationStabilityEngine } from './continuation-stability.engine';
import { SampleQualityEngine } from './sample-quality.engine';
import { OutlierDependencyEngine } from './outlier-dependency.engine';
import { WalkforwardValidationEngine } from './walkforward-validation.engine';
import { CrossSymbolConsistencyEngine } from './cross-symbol-consistency.engine';

/** Composite robustness scoring and classification. */
export class RobustnessScoreEngine {
  private readonly regime = new RegimeValidationEngine();
  private readonly symbol = new SymbolGeneralizationEngine();
  private readonly vol = new VolatilityRobustnessEngine();
  private readonly phase = new MarketPhaseValidationEngine();
  private readonly continuation = new ContinuationStabilityEngine();
  private readonly sample = new SampleQualityEngine();
  private readonly outlier = new OutlierDependencyEngine();
  private readonly walkforward = new WalkforwardValidationEngine();
  private readonly crossSymbol = new CrossSymbolConsistencyEngine();

  evaluate(strategyName: string, signals: SignalSnapshot[]): StrategyValidationMetrics {
    const regimeResult = this.regime.analyze(strategyName, signals);
    const generalization = this.symbol.generalizationScore(signals);
    const regimeConsistency = regimeResult.consistency;
    const outlierDep = 100 - this.outlier.dependencyScore(signals);
    const walkforwardDecay = 100 - this.walkforward.decayScore(signals);
    const continuationQ = this.continuation.quality(signals);
    const crossRows = this.crossSymbol.analyze(strategyName, signals);
    const crossScore = this.crossSymbol.consistencyScore(crossRows);
    const volScore = this.vol.score(signals);
    const timeScore = this.phase.timeRobustnessScore(signals);
    const sampleScore = this.sample.score(signals);

    const outlierAnalysis = this.outlier.analyze(strategyName, signals);
    const walkAnalysis = this.walkforward.analyze(strategyName, signals);
    const genMetrics = this.symbol.analyze(strategyName, signals);

    const robustnessScore = Math.round(
      sampleScore * 0.15 +
      generalization * 0.2 +
      regimeConsistency * 0.15 +
      (100 - outlierDep) * 0.2 +
      (100 - walkforwardDecay) * 0.15 +
      continuationQ * 0.1 +
      crossScore * 0.05
    );

    const classification = this.classify({
      robustnessScore,
      generalization,
      regimeConsistency,
      outlierDependent: outlierAnalysis.outlierDependent,
      walkforwardStable: walkAnalysis.stable,
      symbolConcentration: genMetrics.symbolConcentrationPct,
      uniqueSymbols: genMetrics.uniqueSymbols,
      sampleCount: signals.length,
      recentOnlyBias: this.phase.recentOnlyBias(signals),
      highVolOnly: this.vol.highVolOnly(signals),
      lowConfidence: this.sample.lowConfidence(signals)
    });

    return {
      robustnessScore: Math.min(100, robustnessScore),
      generalizationScore: generalization,
      regimeConsistency,
      outlierDependency: outlierDep,
      walkforwardDecay,
      continuationPersistenceQuality: continuationQ,
      classification
    };
  }

  private classify(ctx: {
    robustnessScore: number;
    generalization: number;
    regimeConsistency: number;
    outlierDependent: boolean;
    walkforwardStable: boolean;
    symbolConcentration: number;
    uniqueSymbols: number;
    sampleCount: number;
    recentOnlyBias: boolean;
    highVolOnly: boolean;
    lowConfidence: boolean;
  }): RobustnessClassification {
    if (ctx.sampleCount < 10) return 'LOW_CONFIDENCE';
    if (ctx.outlierDependent && ctx.walkforwardStable === false) return 'OVERFIT_RISK';
    if (ctx.outlierDependent) return 'OUTLIER_DEPENDENT';
    if (ctx.symbolConcentration > 60 || ctx.uniqueSymbols < 2) return 'SYMBOL_DEPENDENT';
    if (ctx.regimeConsistency < 45 || ctx.highVolOnly) return 'REGIME_DEPENDENT';
    if (ctx.lowConfidence || ctx.recentOnlyBias) return 'LOW_CONFIDENCE';
    if (ctx.robustnessScore >= 75 && ctx.generalization >= 65) return 'ROBUST';
    if (ctx.robustnessScore >= 60) return 'LIKELY_ROBUST';
    if (ctx.walkforwardStable === false && ctx.robustnessScore < 55) return 'OVERFIT_RISK';
    return 'REGIME_DEPENDENT';
  }

  advisoryNote(classification: RobustnessClassification, metrics: StrategyValidationMetrics): string {
    switch (classification) {
      case 'ROBUST': return 'Validated across symbols, regimes, and walk-forward segments.';
      case 'LIKELY_ROBUST': return 'Promising edge — monitor walk-forward decay.';
      case 'REGIME_DEPENDENT': return 'Works in specific market regimes only — reduce size outside trend/expansion.';
      case 'SYMBOL_DEPENDENT': return 'Concentrated in few symbols — not broadly generalizable.';
      case 'OUTLIER_DEPENDENT': return 'Expectancy collapses without top winners — outlier-driven stats.';
      case 'OVERFIT_RISK': return 'High overfit risk — reduce autonomous participation confidence.';
      case 'LOW_CONFIDENCE': return 'Insufficient sample — not authoritative.';
    }
  }

  /** Live safety multiplier 0.5–1.0 (diagnostic only, never disables). */
  confidenceMultiplier(classification: RobustnessClassification): number {
    switch (classification) {
      case 'ROBUST': return 1;
      case 'LIKELY_ROBUST': return 0.95;
      case 'REGIME_DEPENDENT': return 0.85;
      case 'SYMBOL_DEPENDENT': return 0.8;
      case 'LOW_CONFIDENCE': return 0.75;
      case 'OUTLIER_DEPENDENT': return 0.65;
      case 'OVERFIT_RISK': return 0.55;
    }
  }
}
