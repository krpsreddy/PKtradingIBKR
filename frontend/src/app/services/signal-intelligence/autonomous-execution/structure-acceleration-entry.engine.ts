import { AutonomousExecutionInput } from './autonomous-execution.models';
import { ExpansionParticipationEngine } from '../continuation-participation/expansion-participation-engine';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';

export class StructureAccelerationEntryEngine {
  private readonly expansion = new ExpansionParticipationEngine();

  score(input: AutonomousExecutionInput): number {
    const base = this.expansion.score(input as ContinuationParticipationInput);
    const struct = ((input.trendAlignment ?? 0) / 100) * 30 + ((input.rvol ?? 0) > 3 ? 15 : 0);
    return Math.min(100, Math.round(base * 0.7 + struct));
  }
}
