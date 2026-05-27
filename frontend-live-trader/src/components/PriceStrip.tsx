import { memo } from 'react';
import {
  formatChange,
  formatChangePct,
  formatPrice,
  useQuote,
  useQuoteHistory
} from '../services/live-quote-feed/live-quote-feed.service';
import { MiniSparkline } from './MiniSparkline';

interface PriceStripProps {
  symbol: string;
  large?: boolean;
  showSparkline?: boolean;
}

function PriceStripInner({ symbol, large, showSparkline }: PriceStripProps) {
  const q = useQuote(symbol);
  const hist = useQuoteHistory(symbol);
  const pos = q && q.changePercent >= 0;
  const neg = q && q.changePercent < 0;
  const cls = pos ? 'price-up' : neg ? 'price-down' : '';

  return (
    <div className={`price-strip ${large ? 'price-strip-lg' : ''} ${cls}`}>
      <div className="price-row">
        <span className="price-val">${formatPrice(q?.price)}</span>
        {showSparkline && q && <MiniSparkline prices={hist} trend={q.trend} />}
      </div>
      {q && (
        <div className="change-row">
          <span className="change-pct">{formatChangePct(q.changePercent)}</span>
          {q.change !== 0 && <span className="change-abs">{formatChange(q.change)}</span>}
          {q.stale && <span className="badge-delayed">DELAYED</span>}
        </div>
      )}
    </div>
  );
}

export const PriceStrip = memo(PriceStripInner);
