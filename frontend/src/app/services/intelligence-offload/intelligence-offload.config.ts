/** Phase 164 — backend intelligence offload configuration. */
export const INTELLIGENCE_OFFLOAD = {
  /** When true, heavy synthesis runs on backend; frontend is visualization-only. */
  enabled: true,
  /** Skip local revision$ fan-out refresh in synthesis services. */
  skipFrontendSynthesis: true,
  /** Cache TTL for live symbol snapshots (ms). */
  liveCacheTtlMs: 30_000
};
