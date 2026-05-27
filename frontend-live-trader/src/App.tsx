import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSnapshot, fetchTier1, putRuntime, setPaperMode } from './api';
import {
  HeroPanel,
  OppCardPanel,
  PnlPanel,
  PositionCardPanel
} from './components/TraderPanels';
import { usePolling } from './hooks/usePolling';
import { textLine } from './format';
import {
  startLiveQuoteFeed,
  stopLiveQuoteFeed,
  useQuoteFeedStatus
} from './services/live-quote-feed/live-quote-feed.service';
import type { RuntimeControls, Tier1Snapshot } from './types';

function collectRankedSymbols(tier1: Tier1Snapshot | null | undefined): string[] {
  if (!tier1) return [];
  const out: string[] = [];
  if (tier1.dominant) out.push(tier1.dominant.symbol);
  for (const o of tier1.topRanked ?? []) out.push(o.symbol);
  for (const o of tier1.degrading ?? []) out.push(o.symbol);
  return out;
}

function collectPositionSymbols(snap: { activePositions?: { symbol: string }[] } | null): string[] {
  return (snap?.activePositions ?? []).map(p => p.symbol);
}

export default function App() {
  const [runtime, setRuntime] = useState<RuntimeControls>({
    scanningEnabled: true,
    telegramEnabled: false,
    autoExecutionEnabled: false,
    executionMode: 'OFF'
  });

  const tier1Poll = usePolling(fetchTier1, 1000, runtime.scanningEnabled);
  const fullPoll = usePolling(fetchSnapshot, 5000, runtime.scanningEnabled);

  const tier1 = tier1Poll.data;
  const snap = fullPoll.data;

  const tier1Ref = useRef(tier1);
  const snapRef = useRef(snap);
  tier1Ref.current = tier1;
  snapRef.current = snap;

  const feedStatus = useQuoteFeedStatus();

  useEffect(() => {
    const enabled = runtime.scanningEnabled;
    startLiveQuoteFeed(
      () => {
        const t = tier1Ref.current;
        const s = snapRef.current;
        const fast: string[] = [];
        if (t?.dominant) fast.push(t.dominant.symbol);
        fast.push(...collectPositionSymbols(s));
        return [...new Set(fast)];
      },
      () => collectRankedSymbols(tier1Ref.current),
      enabled
    );
    return () => stopLiveQuoteFeed();
  }, [runtime.scanningEnabled]);

  useEffect(() => {
    putRuntime(runtime).catch(() => {});
    if (runtime.executionMode === 'OFF' || runtime.executionMode === 'PAPER_RESEARCH') {
      setPaperMode(runtime.executionMode).catch(() => {});
    }
  }, [runtime]);

  const toggle = (key: keyof RuntimeControls, on?: boolean) => {
    setRuntime(prev => ({
      ...prev,
      [key]: on ?? !(prev[key] as boolean)
    }));
  };

  const setExecMode = useCallback((mode: 'OFF' | 'PAPER_RESEARCH') => {
    setRuntime(prev => ({ ...prev, executionMode: mode, autoExecutionEnabled: mode === 'PAPER_RESEARCH' }));
  }, []);

  const emotion = textLine(snap?.market?.marketEmotion);
  const marketLabel = emotion !== '—' ? emotion : textLine(snap?.market?.sessionMode);
  const ibkrOk = snap?.paperStatus?.ibkrConnected;

  const advisoryBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of snap?.advisories ?? []) {
      const m = a.match(/^([A-Z]{1,5})\b/);
      if (m) map.set(m[1], a);
    }
    return map;
  }, [snap?.advisories]);

  return (
    <div className="app">
      <div className="status-line">
        PK Live Trader · {marketLabel} · IBKR {ibkrOk ? 'connected' : 'offline'}
        {feedStatus.delayed && <span className="badge-delayed-inline"> · PRICE DELAYED</span>}
        {tier1Poll.error && ` · ${tier1Poll.error}`}
      </div>

      <div className="controls">
        <button type="button" className={`toggle ${runtime.scanningEnabled ? 'on' : 'off'}`} onClick={() => toggle('scanningEnabled')}>
          SCAN {runtime.scanningEnabled ? 'ON' : 'OFF'}
        </button>
        <button type="button" className={`toggle ${runtime.telegramEnabled ? 'on' : 'off'}`} onClick={() => toggle('telegramEnabled')}>
          TELEGRAM {runtime.telegramEnabled ? 'ON' : 'OFF'}
        </button>
        <button type="button" className={`toggle ${runtime.executionMode === 'PAPER_RESEARCH' ? 'on' : 'off'}`} onClick={() => setExecMode(runtime.executionMode === 'PAPER_RESEARCH' ? 'OFF' : 'PAPER_RESEARCH')}>
          AUTO EXEC {runtime.executionMode === 'PAPER_RESEARCH' ? 'PAPER' : 'OFF'}
        </button>
      </div>

      <HeroPanel opp={tier1?.dominant ?? null} />

      <div className="section-title">Top ranked</div>
      {(tier1?.topRanked ?? []).slice(0, 8).map((o, i) => (
        <OppCardPanel key={o.symbol} opp={o} rank={i + 1} />
      ))}

      {(tier1?.degrading?.length ?? 0) > 0 && (
        <>
          <div className="section-title">Exhaustion / degrading</div>
          {tier1!.degrading.map((o, i) => <OppCardPanel key={`d-${o.symbol}`} opp={o} rank={i + 1} />)}
        </>
      )}

      {snap && (
        <>
          <div className="section-title">P&amp;L</div>
          <PnlPanel pnl={snap.pnl} positions={snap.activePositions} />

          <div className="section-title">Exit advisories</div>
          {snap.advisories.length === 0 && <div className="status-line">None</div>}
          {snap.advisories.map(a => <div key={a} className="advisory">{a}</div>)}

          <div className="section-title">Active positions</div>
          {snap.activePositions.length === 0 && <div className="status-line">No open paper positions</div>}
          {snap.activePositions.map(p => (
            <PositionCardPanel
              key={p.id}
              position={p}
              advisory={advisoryBySymbol.get(p.symbol)}
            />
          ))}
        </>
      )}
    </div>
  );
}
