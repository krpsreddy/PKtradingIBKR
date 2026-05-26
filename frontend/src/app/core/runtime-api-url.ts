import { environment } from '../../environments/environment';

/** When opened via ngrok, force relative /api so ng serve proxy handles requests (not localhost:8080). */
export function applyRuntimeApiUrl(): void {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  const onNgrok =
    host.includes('ngrok-free.app') ||
    host.includes('ngrok-free.dev') ||
    host.includes('ngrok.app') ||
    host.endsWith('.ngrok.io');
  if (onNgrok) {
    if (environment.apiUrl.startsWith('http')) {
      environment.apiUrl = '/api';
    }
    environment.ngrokMode = true;
  }
}
