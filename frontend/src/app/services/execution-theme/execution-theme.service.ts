import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

/** Phase 169 — applies semantic theme class to document root. */
@Injectable({ providedIn: 'root' })
export class ExecutionThemeService {
  private readonly renderer: Renderer2;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.applyDarkTheme();
  }

  applyDarkTheme(): void {
    this.renderer.addClass(document.documentElement, 'theme-execution-dark');
  }
}
