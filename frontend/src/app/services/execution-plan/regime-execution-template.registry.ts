import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';

/** Phase 172/175 — legacy stub list; live templates in autonomous-execution-templates. */
export interface RegimeExecutionTemplateStub {
  regime: CanonicalExecutionRegime;
  templateId: string;
  description: string;
}

const STUBS: RegimeExecutionTemplateStub[] = [
  { regime: 'EARLY_EXPANSION', templateId: 'EARLY_EXPANSION', description: 'Aggressive entry · wider stop · momentum target (pending)' },
  { regime: 'INSTITUTIONAL_PERSISTENCE', templateId: 'INSTITUTIONAL_PERSISTENCE', description: 'Pullback/VWAP hold · structure stop (pending)' },
  { regime: 'VWAP_ACCEPTANCE', templateId: 'VWAP_ACCEPTANCE', description: 'Reclaim entry · VWAP invalidation (pending)' },
  { regime: 'SHALLOW_PULLBACK_CONTINUATION', templateId: 'SHALLOW_PULLBACK_CONTINUATION', description: 'Shallow PB · continuation target (pending)' },
  { regime: 'HEALTHY_EXTENSION', templateId: 'HEALTHY_EXTENSION', description: 'Reduced size · tighter invalidation (pending)' },
  { regime: 'EXHAUSTION_DRIFT', templateId: 'EXHAUSTION_DRIFT', description: 'No-entry / trim / exit bias (pending)' },
  { regime: 'COMPRESSION_BREAKOUT', templateId: 'COMPRESSION_BREAKOUT', description: 'Compression breakout (pending)' },
  { regime: 'PERSISTENT_CONTINUATION', templateId: 'PERSISTENT_CONTINUATION', description: 'Persistent continuation (pending)' }
];

export class RegimeExecutionTemplateRegistry {
  list(): RegimeExecutionTemplateStub[] {
    return [...STUBS];
  }

  find(regime: string): RegimeExecutionTemplateStub | undefined {
    return STUBS.find(s => s.regime === regime || s.templateId === regime);
  }
}
