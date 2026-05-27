import { memo } from 'react';
import { textLine, whyNowText } from '../format';
import { useLiveUnrealizedUsd, useQuote } from '../services/live-quote-feed/live-quote-feed.service';
import type { LiveTraderSnapshot, RankedOpportunity } from '../types';
import { PriceStrip } from './PriceStrip';

export const HeroPanel = memo(function HeroPanel({ opp }: { opp: RankedOpportunity | null }) {
  if (!opp) {
    return (
      <div className="hero weak">
        <h1>—</h1>
        <div className="regime">Scanning idle</div>
      </div>
    );
  }
  const why = whyNowText(opp.whyNow);
  return (
    <div className={`hero tone-${opp.tone}`}>
      <div className="regime">{opp.regime} · {opp.badge}</div>
      <div className="hero-title-row">
        <h1>{opp.symbol}</h1>
        <PriceStrip symbol={opp.symbol} large showSparkline />
      </div>
      <div className="metrics">
        <div className="metric"><span>Conviction</span><strong>{opp.conviction}</strong></div>
        <div className="metric"><span>Persistence</span><strong>{opp.persistenceSeconds}s</strong></div>
        <div className="metric"><span>Velocity</span><strong>{opp.convictionVelocity > 0 ? '+' : ''}{opp.convictionVelocity}</strong></div>
      </div>
      <div className="bar-row">
        <label>Institutional pressure</label>
        <div className="bar"><i style={{ width: `${Math.min(100, opp.institutionalPressure)}%` }} /></div>
      </div>
      <div className="why">{why !== '—' ? why : opp.entryZoneLabel}</div>
    </div>
  );
});

export const OppCardPanel = memo(function OppCardPanel({ opp, rank }: { opp: RankedOpportunity; rank: number }) {
  return (
    <div className={`card tone-${opp.tone}`}>
      <div className="card-top">
        <div className="card-symbol-block">
          <strong>{opp.symbol}</strong>
          <span className="rank">#{rank}</span>
        </div>
        <PriceStrip symbol={opp.symbol} />
      </div>
      <div className="card-metrics">
        C{opp.conviction} · P{opp.persistenceSeconds}s · I{opp.institutionalPressure} · dom {opp.dominanceScore}
      </div>
      <div className="card-regime">{opp.regime}</div>
    </div>
  );
});

function unrealizedUsd(entry: number, qty: number, last: number): number {
  return (last - entry) * qty;
}

export const PositionCardPanel = memo(function PositionCardPanel({
  position,
  advisory
}: {
  position: LiveTraderSnapshot['activePositions'][0];
  advisory?: string;
}) {
  const q = useQuote(position.symbol);
  const entry = position.fillPrice ?? position.entryPrice ?? 0;
  const qty = position.quantity ?? 0;
  const last = q?.price;
  const unrealized =
    last != null && entry > 0 && qty > 0 ? unrealizedUsd(entry, qty, last) : null;
  const pct =
    last != null && entry > 0 ? ((last - entry) / entry) * 100 : null;

  return (
    <div className="card position-card">
      <div className="card-top">
        <div className="card-symbol-block">
          <strong>{position.symbol}</strong>
          <span className="lifecycle">{position.status}</span>
        </div>
        <PriceStrip symbol={position.symbol} />
      </div>
      <div className="position-detail">
        <span>Entry ${entry > 0 ? entry.toFixed(2) : '—'}</span>
        <span>Qty {qty || '—'}</span>
        {unrealized != null && (
          <span className={unrealized >= 0 ? 'price-up' : 'price-down'}>
            Unreal ${unrealized.toFixed(2)}
            {pct != null && ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`}
          </span>
        )}
        {position.realizedR != null && <span>Realized {Number(position.realizedR).toFixed(3)}R</span>}
        <span>MFE {position.mfeR ?? '—'} · MAE {position.maeR ?? '—'}</span>
      </div>
      {(position.exitSuggestion || advisory) && (
        <div className="advisory">{position.exitSuggestion ?? advisory}</div>
      )}
      <div className="card-regime">{position.regime}</div>
    </div>
  );
});

export const PnlPanel = memo(function PnlPanel({
  pnl,
  positions
}: {
  pnl: LiveTraderSnapshot['pnl'];
  positions: LiveTraderSnapshot['activePositions'];
}) {
  const { total: liveUnrealized, hasLive } = useLiveUnrealizedUsd(positions);

  return (
    <div className="pnl-grid">
      <div className="pnl-cell">
        <span>Unrealized ΣR</span>
        <strong>{Number(pnl.unrealizedSumR).toFixed(3)}</strong>
        {hasLive && (
          <div className={`pnl-live ${liveUnrealized >= 0 ? 'price-up' : 'price-down'}`}>
            Live ${liveUnrealized.toFixed(2)}
          </div>
        )}
      </div>
      <div className="pnl-cell"><span>Realized ΣR</span><strong>{Number(pnl.realizedSumR).toFixed(3)}</strong></div>
      <div className="pnl-cell"><span>Open</span><strong>{pnl.openPositions}</strong></div>
      <div className="pnl-cell"><span>Closed today</span><strong>{pnl.closedToday}</strong></div>
    </div>
  );
});
