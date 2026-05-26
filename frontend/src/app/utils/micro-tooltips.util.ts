export const TOOLTIPS = {
  rank: 'Composite rank 0–100 from RVOL, freshness, MTF, regime, and signal quality. Higher = better options timing.',
  mtf: 'Multi-timeframe alignment (5m/15m/1h). Aligned bullish setups have fewer false breakouts.',
  ext: 'Price extended from EMA9/VWAP — late options entry risk, theta burn likely.',
  freshness: 'How recent the signal is. NEW/FRESH signals retain edge; STALE signals lose options edge fast.',
  optionsRisk: 'Options-specific warnings: theta, chop, spread, or late entry risk.',
  attention: 'What deserves your focus right now based on freshness, rank, and market context.',
  entryQuality: 'EARLY/GOOD = favorable timing. LATE/CHASING = elevated theta and slippage risk.',
  deterioration: 'Setup losing momentum — RVOL fade, VWAP loss, or lifecycle weakening.'
};
