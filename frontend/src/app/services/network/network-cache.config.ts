/** TTL presets for client-side API cache (milliseconds). */
export const NETWORK_CACHE_TTL = {
  snapshot: 5_000,
  confidence: 15_000,
  aiInsight: 60_000,
  enrichSymbol: 120_000,
  symbolsList: 30_000,
  systemStatus: 8_000,
  cognition: 8_000,
  probabilistic: 10_000,
  historicalInsight: 60_000,
  scanner: 30_000,
  executionFeed: 2_000,
  activeSignals: 5_000,
  momentumBundle: 15_000
} as const;

export type NetworkCacheBucket = keyof typeof NETWORK_CACHE_TTL;
