/** Phase 181 — evolution app variant (ports 4300 / 8180). */
export const environment = {
  production: false,
  appVariant: 'evolution' as const,
  storagePrefix: 'pk-evolution-',
  apiUrl: 'http://localhost:8180/api',
  ngrokMode: false,
  dashboardPollMs: 15_000,
  dashboardHeavyPollMs: 60_000,
  feedPollMs: 2_000,
  showNetworkDiagnostics: true,
  paperExecutionResearch: true
};
