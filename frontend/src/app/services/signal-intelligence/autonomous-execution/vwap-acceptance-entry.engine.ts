import { AutonomousExecutionInput } from './autonomous-execution.models';
import { VwapAcceptanceContinuationEngine } from '../continuation-participation/vwap-acceptance-continuation.engine';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';

export class VwapAcceptanceEntryEngine {
  private readonly vwap = new VwapAcceptanceContinuationEngine();

  score(input: AutonomousExecutionInput): number {
    return this.vwap.score(input as ContinuationParticipationInput);
  }
}
