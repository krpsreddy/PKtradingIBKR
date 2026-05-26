import { Injectable } from '@angular/core';
import { SeriesMarker, Time } from 'lightweight-charts';
import { TradingSignal } from '../../models/signal.model';
import { ReplayEntryDecisionEngine } from './replay-entry-decision.engine';
import { ReplayExitVisualizationEngine } from './replay-exit-visualization.engine';
import { ReplayStudyMode } from './replay-decision-visualization.models';
import { IntelligenceOffloadService } from '../intelligence-offload/intelligence-offload.service';
import { ReplayIntelligenceCacheService } from '../intelligence-offload/replay-intelligence-cache.service';

@Injectable({ providedIn: 'root' })
export class ReplaySignalOverlayEngine {
  constructor(
    private entryDecision: ReplayEntryDecisionEngine,
    private exitViz: ReplayExitVisualizationEngine,
    private offload: IntelligenceOffloadService,
    private replayCache: ReplayIntelligenceCacheService
  ) {}

  buildProfessionalMarkers(
    signals: TradingSignal[],
    candleTimes: Set<number>,
    snapToCandle: (ts: string, times: Set<number>) => number | null,
    studyMode: ReplayStudyMode,
    cursorIndex: number,
    barIndexByTime: Map<number, number>,
    replaySymbol?: string,
    replaySession?: string
  ): SeriesMarker<Time>[] {
    if (this.offload.isEnabled() && replaySymbol && replaySession) {
      const precomputed = this.replayCache.getMarkers(replaySymbol, replaySession);
      if (precomputed?.length) {
        return this.markersFromPrecomputed(precomputed, candleTimes, snapToCandle, studyMode, cursorIndex, barIndexByTime);
      }
    }

    const markers: SeriesMarker<Time>[] = [];
    const seen = new Set<number>();
    const ordered = signals.slice().sort((a, b) => this.markerPriority(a) - this.markerPriority(b));

    for (const signal of ordered) {
      const snapped = snapToCandle(signal.timestamp, candleTimes);
      if (snapped == null || seen.has(snapped)) continue;

      const barIdx = barIndexByTime.get(snapped);
      if (studyMode === 'TRAINING' && barIdx != null && barIdx > cursorIndex) continue;

      seen.add(snapped);
      const time = snapped as Time;
      const exit = this.exitViz.buildOverlay(signal);
      if (exit) {
        markers.push({
          time,
          position: 'aboveBar',
          color: exit.markerColor,
          shape: 'arrowDown',
          text: exit.markerText.split('\n')[0]
        });
        continue;
      }

      const entry = this.entryDecision.buildOverlay(signal);
      markers.push({
        time,
        position: entry.position,
        color: entry.markerColor,
        shape: entry.shape,
        text: studyMode === 'STUDY' ? entry.markerText.split('\n')[0] : entry.compactLabel.split('\n')[0]
      });
    }

    return markers.sort((a, b) => (a.time as number) - (b.time as number));
  }

  /** Precomputed backend markers — no client rescoring. */
  private markersFromPrecomputed(
    precomputed: import('../intelligence-offload/intelligence-snapshot-api.service').ReplayMarkerDto[],
    candleTimes: Set<number>,
    snapToCandle: (ts: string, times: Set<number>) => number | null,
    studyMode: ReplayStudyMode,
    cursorIndex: number,
    barIndexByTime: Map<number, number>
  ): SeriesMarker<Time>[] {
    const markers: SeriesMarker<Time>[] = [];
    const seen = new Set<number>();
    for (const m of precomputed) {
      const ts = new Date(m.timestamp).toISOString();
      const snapped = snapToCandle(ts, candleTimes);
      if (snapped == null || seen.has(snapped)) continue;
      const barIdx = barIndexByTime.get(snapped);
      if (studyMode === 'TRAINING' && barIdx != null && barIdx > cursorIndex) continue;
      seen.add(snapped);
      markers.push({
        time: snapped as Time,
        position: m.position as 'aboveBar' | 'belowBar',
        color: m.markerColor,
        shape: m.shape as 'arrowUp' | 'circle' | 'arrowDown',
        text: m.markerText
      });
    }
    return markers.sort((a, b) => (a.time as number) - (b.time as number));
  }

  /** Prefer opening expansion > continuation > generic WAIT when bars collide. */
  private markerPriority(signal: TradingSignal): number {
    const t = signal.signalType;
    if (t.includes('OPEN') || t === 'IMBALANCE_UP' || t === 'OPEN_MOM_BUY' || t === 'OPEN_SCOUT') return 0;
    if (t === 'CONT_BUY' || t === 'PULL_BUY' || t === 'MOM_BUY') return 1;
    if (t === 'CONT_READY' || t === 'PULL_READY') return 2;
    if (t === 'MOM_READY') return 3;
    if (t === 'EXIT' || t.includes('FAIL') || t === 'IMBALANCE_DOWN') return 5;
    return 4;
  }
}
