import { ContinuationParticipationSynthesisService } from '../continuation-participation/continuation-participation-synthesis.service';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';

/** Bridge continuation participation into autonomous execution layer. */
export class ContinuationParticipationEngine {
  constructor(private participation: ContinuationParticipationSynthesisService) {}

  overlay(original: LiveExecutionDecision, input: ContinuationParticipationInput) {
    return this.participation.buildOverlay(original, input);
  }
}
