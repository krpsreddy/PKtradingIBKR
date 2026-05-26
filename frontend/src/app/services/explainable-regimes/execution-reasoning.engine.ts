import { LiveRegimeClassification, LiveRegimeInput, LiveRegimeMetrics, LiveRegimeType } from '../live-regime-intelligence/live-regime.models';
import { FeatureContributionEngine } from './feature-contribution.engine';
import { InvalidationConditionEngine } from './invalidation-condition.engine';
import { PersistenceConditionEngine } from './persistence-condition.engine';
import { TriggerConditionEngine } from './trigger-condition.engine';
import { ThresholdDecompositionEngine } from './threshold-decomposition.engine';
import { REGIME_FORMULAS } from './regime-threshold-engine';
import { ExplainableRegimeExplanation } from './explainable-regime.models';

/** Assembles full explainable regime output. */
export class ExecutionReasoningEngine {
  private readonly triggers = new TriggerConditionEngine();
  private readonly persistence = new PersistenceConditionEngine();
  private readonly invalidation = new InvalidationConditionEngine();
  private readonly contributions = new FeatureContributionEngine();
  private readonly decomposition = new ThresholdDecompositionEngine();

  build(
    input: LiveRegimeInput,
    metrics: LiveRegimeMetrics,
    regimeType: LiveRegimeType,
    classification: LiveRegimeClassification,
    participationOpportunity: boolean,
    debugMode: boolean
  ): ExplainableRegimeExplanation {
    const trigger = this.triggers.detectWithChecks(input, metrics);
    const persist = this.persistence.buildChecks(input, metrics);
    const invalid = this.invalidation.buildChecks(input, metrics);
    const entryMetrics = this.decomposition.decomposeLiveMetrics(input, metrics);
    const promo = this.triggers.entryPromotionChecks(metrics);

    const persistContrib = this.contributions.buildPersistenceContributions(input);
    const accelContrib = this.contributions.buildAccelerationContributions(input);
    const expContrib = this.contributions.buildExpansionContributions(
      metrics.continuationPersistenceScore,
      metrics.accelerationIntegrity,
      metrics.shallowPullbackQuality,
      metrics.institutionalParticipationScore,
      input
    );
    const conviction = this.contributions.convictionFromMetrics(
      metrics.continuationPersistenceScore,
      metrics.accelerationIntegrity,
      metrics.expansionProbability,
      metrics.exhaustionProbability
    );

    const allContrib = [...persistContrib, ...accelContrib, ...expContrib, ...conviction.contributions];

    const whyValid: string[] = [];
    const whyInvalid: string[] = [];
    if (participationOpportunity) {
      whyValid.push(...trigger.triggeredBecause);
      whyValid.push(...persist.logic.filter(l => l.includes('≥') || l.includes('active')));
    } else {
      whyInvalid.push(...invalid.rules);
      if (metrics.continuationPersistenceScore < 58) {
        whyInvalid.push(`continuationPersistence ${metrics.continuationPersistenceScore} < 58 threshold`);
      }
      if (metrics.exhaustionProbability >= 70) {
        whyInvalid.push(`exhaustion ${metrics.exhaustionProbability} ≥ 70 blocks participation`);
      }
    }

    const whyUp: string[] = [];
    const whyDown: string[] = [];
    for (const c of conviction.contributions) {
      if (c.delta > 0) whyUp.push(`${c.feature}: ${c.delta > 0 ? '+' : ''}${c.delta} → ${c.runningTotal}`);
      if (c.delta < 0) whyDown.push(`${c.feature}: ${c.delta} → ${c.runningTotal}`);
    }

    const whyHealthy: string[] = [];
    if (input.extended && metrics.continuationPersistenceScore >= 58 && metrics.accelerationIntegrity >= 55) {
      whyHealthy.push(`Extended but healthy: persist=${metrics.continuationPersistenceScore}, accel=${metrics.accelerationIntegrity}`);
    }

    const whyExhaust: string[] = [];
    if (metrics.exhaustionProbability >= 55) {
      whyExhaust.push(`Exhaustion probability ${metrics.exhaustionProbability}% (formula: ${REGIME_FORMULAS['exhaustionProbability']})`);
      if (input.extended && (input.rvol ?? 0) < 1.5) {
        whyExhaust.push(`Extended + low RVOL (${input.rvol ?? 0} < 1.5) adds +25 exhaustion risk`);
      }
    }

    return {
      advisoryOnly: true,
      regimeType: trigger.regimeType,
      regimeLabel: trigger.regimeType.replace(/_/g, ' '),
      classification,
      symbol: input.symbol,
      entryConditions: [...entryMetrics, ...trigger.checks.filter(c => c.passed), ...promo.filter(c => c.passed)],
      invalidationConditions: [...invalid.checks, ...promo.filter(c => !c.passed)],
      triggerSequence: [],
      featureContributions: allContrib,
      convictionBase: conviction.base,
      finalConviction: conviction.final,
      whyEntryValid: whyValid,
      whyEntryInvalidated: whyInvalid,
      whyConfidenceIncreased: whyUp,
      whyConfidenceDropped: whyDown,
      whyExtensionHealthy: whyHealthy,
      whyExhaustionDetected: whyExhaust,
      persistenceLogic: persist.logic,
      exhaustionRules: invalid.rules,
      formulas: { ...REGIME_FORMULAS },
      rawMetrics: {
        rvol: input.rvol ?? 0,
        vwapDistance: input.vwapDistance ?? 0,
        pullbackDepth: input.pullbackDepth ?? 0,
        structureScore: input.structureScore ?? 0,
        sessionMinutes: input.sessionTimeMinutes ?? 0,
        continuationPersistenceScore: metrics.continuationPersistenceScore,
        accelerationIntegrity: metrics.accelerationIntegrity,
        shallowPullbackQuality: metrics.shallowPullbackQuality,
        expansionProbability: metrics.expansionProbability,
        exhaustionProbability: metrics.exhaustionProbability,
        institutionalParticipationScore: metrics.institutionalParticipationScore,
        extended: !!input.extended,
        participationOpportunity
      },
      debugMode
    };
  }
}
