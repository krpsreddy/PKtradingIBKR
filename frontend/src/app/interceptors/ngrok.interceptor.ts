import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

function isNgrokHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h.includes('ngrok-free.app') || h.includes('ngrok.app') || h.endsWith('.ngrok.io');
}

/** Skip ngrok free-tier browser interstitial on API fetches. */
export const ngrokInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.ngrokMode && !isNgrokHost()) {
    return next(req);
  }
  return next(req.clone({
    setHeaders: { 'ngrok-skip-browser-warning': 'true' },
    withCredentials: true
  }));
};
