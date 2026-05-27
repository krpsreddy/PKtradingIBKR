import { useEffect, useState } from 'react';
import { fetchTier1, putRuntime } from './api';
import { usePolling } from './hooks/usePolling';
import { whyNowText } from './format';
import type { RankedOpportunity, RuntimeControls } from './types';

function Hero({ opp }: { opp: RankedOpportunity | null }) {
  if (!opp) return <div className="hero weak"><h1>—</h1><div className="regime">Scan off</div></div>;
  return (
    <div className={`hero tone-${opp.tone}`}>
      <div className="regime">{opp.regime}</div>
      <h1>{opp.symbol}</h1>
      <div className="metrics">
        <div className="metric"><span>Conv</span><strong>{opp.conviction}</strong></div>
        <div className="metric"><span>Persist</span><strong>{opp.persistenceSeconds}s</strong></div>
        <div className="metric"><span>Vel</span><strong>{opp.convictionVelocity}</strong></div>
      </div>
      <div className="why">{whyNowText(opp.whyNow)}</div>
    </div>
  );
}

export default function App() {
  const [runtime, setRuntime] = useState<RuntimeControls>({
    scanningEnabled: true,
    telegramEnabled: false,
    autoExecutionEnabled: false,
    executionMode: 'OFF'
  });
  const { data: tier1 } = usePolling(fetchTier1, 1000, runtime.scanningEnabled);

  useEffect(() => {
    putRuntime(runtime).catch(() => {});
  }, [runtime]);

  return (
    <div className="app">
      <div className="status-line">PK Live Screener</div>
      <div className="controls">
        <button type="button" className={`toggle ${runtime.scanningEnabled ? 'on' : 'off'}`}
          onClick={() => setRuntime(r => ({ ...r, scanningEnabled: !r.scanningEnabled }))}>
          SCAN {runtime.scanningEnabled ? 'ON' : 'OFF'}
        </button>
        <button type="button" className={`toggle ${runtime.telegramEnabled ? 'on' : 'off'}`}
          onClick={() => setRuntime(r => ({ ...r, telegramEnabled: !r.telegramEnabled }))}>
          TELEGRAM {runtime.telegramEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
      <Hero opp={tier1?.dominant ?? null} />
      <div className="section-title">Top ranked</div>
      {(tier1?.topRanked ?? []).slice(0, 8).map((o, i) => (
        <div key={o.symbol} className={`card tone-${o.tone}`}>
          <strong>{o.symbol}</strong> <span className="rank">#{i + 1}</span>
          <div style={{ fontSize: '0.72rem', color: '#8b949e' }}>{o.regime} · dom {o.dominanceScore}</div>
        </div>
      ))}
    </div>
  );
}
