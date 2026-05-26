/** ngrok dev — API proxied by ng serve to localhost:8080 (same origin via frontend tunnel). */
export const environment = {
  production: false,
  apiUrl: '/api',
  ngrokMode: true,
  dashboardPollMs: 30_000,
  dashboardHeavyPollMs: 120_000,
  feedPollMs: 4_000
};
