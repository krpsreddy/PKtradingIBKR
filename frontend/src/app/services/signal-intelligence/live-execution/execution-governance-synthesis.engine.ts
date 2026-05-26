import {
  ConfidenceWeightedSuppression,
  DailyPlaybookPrioritySnapshot,
  ExecutionQualitySnapshot
} from './live-execution.models';
import { governanceLabel } from './confidence-weighted-suppression.engine';

/** Deterministic coach summary — analytics authoritative, no AI invention. */
export class ExecutionGovernanceSynthesisEngine {

  summarize(
    governance: ConfidenceWeightedSuppression,
    executionQuality: ExecutionQualitySnapshot,
    playbookPriorities: DailyPlaybookPrioritySnapshot
  ): string {
    const parts: string[] = [];

    const gov = governanceLabel(governance.state);
    parts.push(`${gov} (${governance.confidence} confidence, ${governance.statisticalConfidence}% statistical)`);

    if (playbookPriorities.preferred[0]) {
      parts.push(`Favor ${playbookPriorities.preferred[0].playbook.toLowerCase()}`);
    }
    if (playbookPriorities.avoid[0]) {
      parts.push(`Avoid ${playbookPriorities.avoid[0].playbook.toLowerCase()}`);
    }

    if (executionQuality.chaseRisk === 'HIGH') {
      parts.push('Chase risk elevated — wait for confirmation');
    } else if (executionQuality.entryTiming === 'IDEAL') {
      parts.push('Entry timing favorable');
    }

    if (executionQuality.signalVsExecution === 'EXECUTION_ISSUE') {
      parts.push('Recent losses skew toward execution timing, not signal quality');
    } else if (executionQuality.signalVsExecution === 'SIGNAL_ISSUE') {
      parts.push('Signal quality weak independent of entry timing');
    }

    if (governance.state === 'REDUCE_SIZE' || governance.state === 'SELECTIVE') {
      parts.push('Reduce size on marginal setups today');
    }

    return parts.join('. ') + '.';
  }
}
