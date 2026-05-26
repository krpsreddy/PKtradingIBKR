/** Tracks scanner refresh cadence and cache validity. */
export const SCANNER_CACHE_TTL_MS = 30_000;
export const SCANNER_POLL_MS = 15_000;

export function cacheValid(generatedAt: number, ttlMs = SCANNER_CACHE_TTL_MS): boolean {
  return Date.now() - generatedAt < ttlMs;
}

export function shouldRescan(lastScanAt: number, pollMs = SCANNER_POLL_MS): boolean {
  return Date.now() - lastScanAt >= pollMs;
}
