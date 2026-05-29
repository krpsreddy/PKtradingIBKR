import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { ngrokInterceptor } from './interceptors/ngrok.interceptor';
import { replayPerformanceInterceptor } from './interceptors/replay-performance.interceptor';
import { ExecutionThemeService } from './services/execution-theme/execution-theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([ngrokInterceptor, replayPerformanceInterceptor])),
    provideAnimationsAsync(),
    ExecutionThemeService
  ]
};
