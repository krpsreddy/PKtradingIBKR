import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { ReplaySignalEvent } from '../../models/replay.model';

/** Lightweight regime label from replay signal (no live engine). */
export class HistoricalRegimeReconstructorEngine {
  fromSignal(event: ReplaySignalEvent | null): CanonicalExecutionRegime | undefined {
    if (!event) return undefined;
    const t = (event.signalType ?? '').toUpperCase();
    if (t.includes('FAIL') || t.includes('EXHAUST')) return 'EXHAUSTION_DRIFT';
    if (t.includes('PULL')) return 'SHALLOW_PULLBACK_CONTINUATION';
    if (t.includes('VWAP') || t.includes('RECLAIM')) return 'VWAP_ACCEPTANCE';
    if (t.includes('COMPRESS')) return 'COMPRESSION_BREAKOUT';
    if (t.includes('CONT') || t.includes('MOM')) return 'EARLY_EXPANSION';
    return 'INSTITUTIONAL_PERSISTENCE';
  }
}
