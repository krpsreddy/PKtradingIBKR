import { AIConfidencePlaceholder, SignalSnapshot } from '../../models/signal-intelligence.model';

/**
 * Placeholder only — reserved for future probability scoring.
 * NEVER generates live entries or black-box predictions.
 */
export class AIConfidenceEngine {

  readonly disabled = true;

  placeholder(snapshot: SignalSnapshot): AIConfidencePlaceholder {
    return {
      signalId: snapshot.id,
      fakeoutProbability: null,
      continuationProbability: null,
      exhaustionProbability: null,
      momentumPersistenceScore: null,
      note: 'AI confidence scoring not enabled — deterministic intelligence only'
    };
  }

  placeholders(signals: SignalSnapshot[]): AIConfidencePlaceholder[] {
    return signals.map(s => this.placeholder(s));
  }
}
