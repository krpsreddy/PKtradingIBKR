import { Injectable } from '@angular/core';
import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { RegimeTemplateDefinition } from './autonomous-template.models';

const DEFINITIONS: RegimeTemplateDefinition[] = [
  {
    regime: 'EARLY_EXPANSION',
    templateId: 'EARLY_EXPANSION',
    displayName: 'Early Expansion',
    entryStyle: 'Aggressive momentum entry',
    stopStyle: 'Wider volatility stop',
    targetStyle: 'Momentum projection (persistence-weighted)',
    allowsEntry: true,
    baseRewardMultiple: 2.5,
    stopWidthPct: 0.012,
    entryAggression: 1.15
  },
  {
    regime: 'INSTITUTIONAL_PERSISTENCE',
    templateId: 'INSTITUTIONAL_PERSISTENCE',
    displayName: 'Institutional Persistence',
    entryStyle: 'Shallow pullback / hold band',
    stopStyle: 'Structure stop below persistence shelf',
    targetStyle: 'Continuation channel projection',
    allowsEntry: true,
    baseRewardMultiple: 2.05,
    stopWidthPct: 0.009,
    entryAggression: 0.92
  },
  {
    regime: 'VWAP_ACCEPTANCE',
    templateId: 'VWAP_ACCEPTANCE',
    displayName: 'VWAP Acceptance',
    entryStyle: 'Reclaim entry at VWAP',
    stopStyle: 'VWAP loss invalidation',
    targetStyle: 'Persistence continuation target',
    allowsEntry: true,
    baseRewardMultiple: 1.75,
    stopWidthPct: 0.008,
    entryAggression: 0.95
  },
  {
    regime: 'SHALLOW_PULLBACK_CONTINUATION',
    templateId: 'SHALLOW_PULLBACK_CONTINUATION',
    displayName: 'Shallow Pullback Continuation',
    entryStyle: 'Pullback zone entry',
    stopStyle: 'Structure stop under pullback low',
    targetStyle: 'Trend continuation projection',
    allowsEntry: true,
    baseRewardMultiple: 2.15,
    stopWidthPct: 0.0095,
    entryAggression: 0.9
  },
  {
    regime: 'COMPRESSION_BREAKOUT',
    templateId: 'COMPRESSION_BREAKOUT',
    displayName: 'Compression Breakout',
    entryStyle: 'Breakout trigger above compression',
    stopStyle: 'Compression floor invalidation',
    targetStyle: 'Expansion projection from range',
    allowsEntry: true,
    baseRewardMultiple: 2.6,
    stopWidthPct: 0.011,
    entryAggression: 1.05
  },
  {
    regime: 'HEALTHY_EXTENSION',
    templateId: 'HEALTHY_EXTENSION',
    displayName: 'Healthy Extension',
    entryStyle: 'Reduced-size continuation entry',
    stopStyle: 'Tighter extension invalidation',
    targetStyle: 'Continuation-only participation target',
    allowsEntry: true,
    baseRewardMultiple: 1.35,
    stopWidthPct: 0.007,
    entryAggression: 0.75
  },
  {
    regime: 'EXHAUSTION_DRIFT',
    templateId: 'EXHAUSTION_DRIFT',
    displayName: 'Exhaustion Drift',
    entryStyle: 'No new entry',
    stopStyle: 'Trim / exit priority',
    targetStyle: 'De-risk only',
    allowsEntry: false,
    baseRewardMultiple: 0.5,
    stopWidthPct: 0.006,
    entryAggression: 0
  },
  {
    regime: 'PERSISTENT_CONTINUATION',
    templateId: 'PERSISTENT_CONTINUATION',
    displayName: 'Persistent Continuation',
    entryStyle: 'Confirmed trend participation',
    stopStyle: 'Trailing persistence stop',
    targetStyle: 'Velocity-weighted continuation',
    allowsEntry: true,
    baseRewardMultiple: 2.1,
    stopWidthPct: 0.009,
    entryAggression: 1.0
  }
];

@Injectable({ providedIn: 'root' })
export class TemplateRegistryService {
  list(): RegimeTemplateDefinition[] {
    return [...DEFINITIONS];
  }

  get(regime: CanonicalExecutionRegime): RegimeTemplateDefinition {
    return DEFINITIONS.find(d => d.regime === regime) ?? DEFINITIONS[1];
  }
}
