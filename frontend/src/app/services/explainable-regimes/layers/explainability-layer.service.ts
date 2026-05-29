import { Injectable } from '@angular/core';
import { ExplainableRegimeExplanation } from '../explainable-regime.models';
import { ExplainableBearishExplanation } from '../bearish/bearish-regime.models';
import { DiscoveredStrategy } from '../../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { ExplainableClusterContext } from '../explainable-regime.models';
import { LayeredExplainability } from './explainability-layer.models';
import { BullishExplainabilityLayerBuilder } from './bullish-explainability-layer.builder';
import { BearishExplainabilityLayerBuilder } from './bearish-explainability-layer.builder';

/** Phase 208 — unified layered explainability facade. */
@Injectable({ providedIn: 'root' })
export class ExplainabilityLayerService {
  private readonly bullish = new BullishExplainabilityLayerBuilder();
  private readonly bearish = new BearishExplainabilityLayerBuilder();

  buildBullish(
    ex: ExplainableRegimeExplanation,
    strategy?: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): LayeredExplainability {
    return this.bullish.build(ex, strategy, ctx);
  }

  buildBearish(
    ex: ExplainableBearishExplanation,
    strategy?: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): LayeredExplainability {
    return this.bearish.build(ex, strategy, ctx);
  }
}
