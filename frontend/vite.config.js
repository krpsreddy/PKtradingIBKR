/**
 * Vite dev-server host allowlist for ngrok tunnels.
 * Angular merges this when using @angular/build (application builder).
 * Domain suffixes allow any ngrok subdomain without opening all hosts.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.app',
      '.ngrok.dev',
      'localhost',
    ],
  },
});
