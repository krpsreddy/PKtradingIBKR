import { AutonomousEntryType, AutonomousExecutionInput } from './autonomous-execution.models';
import { PullbackStructureEntryEngine } from './pullback-structure-entry.engine';
import { VwapAcceptanceEntryEngine } from './vwap-acceptance-entry.engine';
import { StructureAccelerationEntryEngine } from './structure-acceleration-entry.engine';
import { ExpansionPersistenceEngine } from './expansion-persistence-engine';
import { ContinuationAddEngine } from '../continuation-participation/continuation-add-engine';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';
import { ContinuationRiskBalanceEngine } from '../continuation-participation/continuation-risk-balance.engine';

export class AutonomousEntryRankingEngine {
  private readonly pull = new PullbackStructureEntryEngine();
  private readonly vwap = new VwapAcceptanceEntryEngine();
  private readonly struct = new StructureAccelerationEntryEngine();
  private readonly persist = new ExpansionPersistenceEngine();
  private readonly add = new ContinuationAddEngine();
  private readonly risk = new ContinuationRiskBalanceEngine();

  rank(input: AutonomousExecutionInput, clusterSim: number, regret: number | null): {
    entryType: AutonomousEntryType;
    score: number;
  } {
    if (this.risk.isExhaustion(input as ContinuationParticipationInput)) {
      return { entryType: 'CONTINUATION_ADD', score: 0 };
    }
    const rows: [AutonomousEntryType, number][] = [
      ['STRUCTURE_ACCELERATION_ENTRY', this.struct.score(input)],
      ['VWAP_ACCEPTANCE_CONTINUATION', this.vwap.score(input)],
      ['SHALLOW_PULLBACK_CONTINUATION', this.pull.score(input)],
      ['EARLY_EXPANSION_ENTRY', this.persist.score(input)],
      ['CONTINUATION_ADD', this.add.score(input as ContinuationParticipationInput)],
      ['PERSISTENCE_ENTRY', (input.trendAlignment ?? 0) >= 58 ? this.struct.score(input) : 0],
      ['HIGH_RVOL_CONTINUATION', (input.rvol ?? 0) >= 4 ? this.struct.score(input) : 0]
    ];
    rows.sort((a, b) => b[1] - a[1]);
    const base = rows[0][1];
    const boost = Math.round(clusterSim * 12 + (regret != null && regret >= 2 ? 8 : 0));
    return { entryType: rows[0][0], score: Math.min(100, base + boost) };
  }
}
