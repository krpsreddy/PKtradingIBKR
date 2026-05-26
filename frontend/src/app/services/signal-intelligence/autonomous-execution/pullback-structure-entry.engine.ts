import { AutonomousExecutionInput } from './autonomous-execution.models';
import { PullbackContinuationEngine } from '../continuation-participation/pullback-continuation-engine';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';

export class PullbackStructureEntryEngine {
  private readonly pull = new PullbackContinuationEngine();

  score(input: AutonomousExecutionInput): number {
    return this.pull.score(input as ContinuationParticipationInput);
  }
}
