import { AutonomousExecutionInput } from './autonomous-execution.models';
import { EarlyExpansionWindowEngine } from '../continuation-participation/early-expansion-window.engine';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';

export class ExpansionPersistenceEngine {
  private readonly early = new EarlyExpansionWindowEngine();

  score(input: AutonomousExecutionInput): number {
    return this.early.score(input as ContinuationParticipationInput);
  }
}
