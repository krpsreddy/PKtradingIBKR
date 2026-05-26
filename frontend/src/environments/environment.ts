export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  ngrokMode: false,
  /** Dashboard light poll (status, momentum, symbols config). */
  dashboardPollMs: 15_000,
  /** Dashboard heavy poll (analytics, journal). */
  dashboardHeavyPollMs: 60_000,
  /** Real-time execution feed poll fallback (SSE preferred). */
  feedPollMs: 2_000,
  /** Show dev network diagnostics overlay. */
  showNetworkDiagnostics: true
};
