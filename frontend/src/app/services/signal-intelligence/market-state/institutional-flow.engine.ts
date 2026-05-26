import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { InstitutionalFlowType } from './market-state.models';
import { deriveMarketStateSequence, inferInstitutionalFlow, round2 } from './market-state.util';

/** Infer institutional behavior from market state paths. */
export class InstitutionalFlowEngine {
  summarize(signals: SignalSnapshot[]): { flow: InstitutionalFlowType; sampleCount: number; expectancyR: number }[] {
    const evaluated = evaluatedSignals(signals);
    const buckets = new Map<InstitutionalFlowType, SignalSnapshot[]>();

    for (const s of evaluated) {
      const states = deriveMarketStateSequence(s);
      const flow = inferInstitutionalFlow(s, states);
      buckets.set(flow, [...(buckets.get(flow) ?? []), s]);
    }

    return [...buckets.entries()]
      .map(([flow, bucket]) => ({
        flow,
        sampleCount: bucket.length,
        expectancyR: round2(computeExpectancyR(bucket))
      }))
      .sort((a, b) => b.sampleCount - a.sampleCount);
  }

  dominantFlow(signals: SignalSnapshot[]): InstitutionalFlowType {
    const summary = this.summarize(signals);
    return summary[0]?.flow ?? 'ABSORPTION';
  }

  flowHint(flow: InstitutionalFlowType, secondary?: InstitutionalFlowType): string {
    if (secondary && secondary !== flow) {
      return `${flow.replace(/_/g, ' ')} + ${secondary.replace(/_/g, ' ')}`;
    }
    return flow.replace(/_/g, ' ');
  }
}
