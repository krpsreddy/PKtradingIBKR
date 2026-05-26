import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { JsonPipe, NgClass, SlicePipe } from '@angular/common';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { SignalLabService } from '../services/signal-lab.service';
import {
  ApiLink,
  OpenFailDebug,
  OpenMomDebug,
  OpenScoutDebug,
  MomPullDebug,
  SignalHealth
} from '../models/signal-lab.model';
import { ReplayEventItem, HotMomentumItem, OpeningMomentumItem } from '../models/workspace.model';
import { TradingSignal } from '../models/signal.model';
import { SystemStatus } from '../models/system-status.model';

interface TestResult {
  key: string;
  label: string;
  loading: boolean;
  error: string | null;
  data: unknown;
  fired: boolean | null;
}

@Component({
  selector: 'app-signal-lab',
  standalone: true,
  imports: [FormsModule, RouterLink, JsonPipe, NgClass, SlicePipe],
  templateUrl: './signal-lab.component.html',
  styleUrl: './signal-lab.component.scss'
})
export class SignalLabComponent implements OnInit, OnDestroy {
  symbol = 'QCOM';
  health: SignalHealth | null = null;
  status: SystemStatus | null = null;
  replay: ReplayEventItem[] = [];
  signals: TradingSignal[] = [];
  hot: HotMomentumItem[] = [];
  opening: OpeningMomentumItem[] = [];
  failed: HotMomentumItem[] = [];
  continuation: HotMomentumItem[] = [];

  tests: TestResult[] = [
    { key: 'openMom', label: 'OPEN_MOM_BUY', loading: false, error: null, data: null, fired: null },
    { key: 'openScout', label: 'OPEN_SCOUT', loading: false, error: null, data: null, fired: null },
    { key: 'openFail', label: 'OPEN_FAIL', loading: false, error: null, data: null, fired: null },
    { key: 'momPull', label: 'MOM/PULL', loading: false, error: null, data: null, fired: null }
  ];
  loadingAll = false;
  lastRun: string | null = null;

  apiLinks: ApiLink[] = [];

  private destroy$ = new Subject<void>();

  constructor(private lab: SignalLabService) {}

  ngOnInit(): void {
    this.buildApiLinks();
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildApiLinks(): void {
    const s = () => this.symbol.toUpperCase();
    this.apiLinks = [
      { label: 'Signal health', path: '/health/signals', description: 'Engine windows + pipeline status' },
      { label: 'System status', path: '/system/status', description: 'IBKR connection' },
      { label: 'Open MOM debug', path: `/debug/open-mom/${s()}`, description: 'OPEN_MOM_BUY conditions' },
      { label: 'Open SCOUT debug', path: `/debug/open-scout/${s()}`, description: 'OPEN_SCOUT conditions' },
      { label: 'Open FAIL debug', path: `/debug/open-fail/${s()}`, description: 'OPEN_FAIL / PUT setup' },
      { label: 'MOM/PULL debug', path: `/debug/mom-pull/${s()}`, description: 'MOM_BUY + PULL_BUY conditions' },
      { label: 'Replay timeline', path: `/replay/${s()}`, description: 'Live evaluation audit trail (today)' },
      { label: 'Historical replay', path: `/replay/history/${s()}?date=YYYY-MM-DD`, description: 'Bar-by-bar simulated replay' },
      { label: 'Signals', path: `/signals/${s()}`, description: 'Persisted signals today' },
      { label: 'Hot momentum', path: '/momentum/hot', description: 'Hot scanner' },
      { label: 'Opening momentum', path: '/momentum/opening', description: 'Open setups' },
      { label: 'Failed momentum', path: '/momentum/failed', description: 'OPEN_FAIL scanner' },
      { label: 'Continuation', path: '/momentum/continuation', description: 'CONT setups' }
    ];
  }

  onSymbolChange(): void {
    this.symbol = this.symbol.trim().toUpperCase();
    this.buildApiLinks();
  }

  refreshAll(): void {
    this.refreshHealth();
    this.runAllTests();
  }

  refreshHealth(): void {
    this.lab.getHealth().pipe(takeUntil(this.destroy$)).subscribe({
      next: h => this.health = h,
      error: e => console.error('Health fetch failed', e)
    });
    this.lab.getStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: s => this.status = s,
      error: () => {}
    });
  }

  runAllTests(): void {
    if (this.loadingAll) {
      return;
    }
    this.onSymbolChange();
    this.loadingAll = true;
    const sym = this.symbol;

    for (const t of this.tests) {
      t.loading = true;
      t.error = null;
    }

    forkJoin({
      openMom: this.lab.getOpenMomDebug(sym),
      openScout: this.lab.getOpenScoutDebug(sym),
      openFail: this.lab.getOpenFailDebug(sym),
      momPull: this.lab.getMomPullDebug(sym),
      replay: this.lab.getReplay(sym),
      signals: this.lab.getSignals(sym),
      hot: this.lab.getHotMomentum(),
      opening: this.lab.getOpeningMomentum(),
      failed: this.lab.getFailedMomentum(),
      continuation: this.lab.getContinuation()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.setTest('openMom', res.openMom, this.momFired(res.openMom));
        this.setTest('openScout', res.openScout, this.scoutFired(res.openScout));
        this.setTest('openFail', res.openFail, res.openFail.openFail);
        this.setTest('momPull', res.momPull, this.momPullFired(res.momPull));
        this.replay = res.replay;
        this.signals = res.signals;
        this.hot = res.hot;
        this.opening = res.opening;
        this.failed = res.failed;
        this.continuation = res.continuation;
        this.lastRun = new Date().toLocaleTimeString();
        this.loadingAll = false;
      },
      error: err => {
        console.error('Signal lab tests failed', err);
        this.tests.forEach(t => { t.loading = false; t.error = 'Request failed — is backend running on :8080?'; });
        this.loadingAll = false;
      }
    });
  }

  runSingle(key: string): void {
    const sym = this.symbol.toUpperCase();
    const t = this.tests.find(x => x.key === key);
    if (!t) return;
    t.loading = true;
    t.error = null;

    const onOk = (data: unknown, fired: boolean | null) => this.setTest(key, data, fired);
    const onErr = () => { t.loading = false; t.error = 'Failed'; };

    if (key === 'openMom') {
      this.lab.getOpenMomDebug(sym).pipe(takeUntil(this.destroy$)).subscribe({
        next: data => onOk(data, this.momFired(data)),
        error: onErr
      });
    } else if (key === 'openScout') {
      this.lab.getOpenScoutDebug(sym).pipe(takeUntil(this.destroy$)).subscribe({
        next: data => onOk(data, this.scoutFired(data)),
        error: onErr
      });
    } else if (key === 'openFail') {
      this.lab.getOpenFailDebug(sym).pipe(takeUntil(this.destroy$)).subscribe({
        next: data => onOk(data, data.openFail),
        error: onErr
      });
    } else if (key === 'momPull') {
      this.lab.getMomPullDebug(sym).pipe(takeUntil(this.destroy$)).subscribe({
        next: data => onOk(data, this.momPullFired(data)),
        error: onErr
      });
    }
  }

  private setTest(key: string, data: unknown, fired: boolean | null): void {
    const t = this.tests.find(x => x.key === key);
    if (t) {
      t.loading = false;
      t.error = null;
      t.data = data;
      t.fired = fired;
    }
  }

  private momFired(d: OpenMomDebug): boolean {
    return d.conditions?.['openMomBuy'] === true;
  }

  private scoutFired(d: OpenScoutDebug): boolean {
    const c = d.conditions;
    return c?.['openScout'] === true || d.scoutActive === true;
  }

  private momPullFired(d: MomPullDebug): boolean {
    return d.pullBuy || d.momBuy;
  }

  fullUrl(path: string): string {
    return this.lab.apiUrl(path.replace('SYMBOL', this.symbol.toUpperCase()));
  }

  openApi(path: string): void {
    const resolved = path
      .replace('/debug/open-mom/SYMBOL', `/debug/open-mom/${this.symbol}`)
      .replace('/debug/open-scout/SYMBOL', `/debug/open-scout/${this.symbol}`)
      .replace('/debug/open-fail/SYMBOL', `/debug/open-fail/${this.symbol}`)
      .replace('/replay/SYMBOL', `/replay/${this.symbol}`)
      .replace('/signals/SYMBOL', `/signals/${this.symbol}`);
    window.open(this.lab.apiUrl(resolved), '_blank');
  }

  engineActive(code: string): boolean {
    return this.health?.engines?.find(e => e.code === code)?.activeNow ?? false;
  }

  chipOk(v: boolean | undefined): string {
    return v ? 'ok' : 'fail';
  }
}
