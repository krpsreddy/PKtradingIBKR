import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActiveSignal, HotMomentumItem } from '../../models/workspace.model';
import { EmergingSetup } from '../../models/refinement.model';
import { TradingSymbol } from '../../models/trading-symbol.model';
import { buildSwitcherSections, SymbolSwitcherSection } from '../../utils/smart-empty.util';
import { rankWatchlistSearch, isValidTicker } from '../../utils/watchlist-search.util';

@Component({
  selector: 'app-global-symbol-switcher',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './global-symbol-switcher.component.html',
  styleUrl: './global-symbol-switcher.component.scss'
})
export class GlobalSymbolSwitcherComponent implements OnChanges, OnDestroy {
  @ViewChild('triggerBtn') triggerBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  @Input() symbol = 'NVDA';
  @Input() watchlist: TradingSymbol[] = [];
  @Input() recentSymbols: string[] = [];
  @Input() hotMomentum: HotMomentumItem[] = [];
  @Input() emergingSetups: EmergingSetup[] = [];
  @Input() activeSignals: ActiveSignal[] = [];

  @Output() symbolSelected = new EventEmitter<string>();
  @Output() symbolAdded = new EventEmitter<string>();

  open = false;
  query = '';
  highlightIndex = -1;
  flatSymbols: string[] = [];
  sections: SymbolSwitcherSection[] = [];
  dropdownTop = 0;
  dropdownLeft = 0;

  constructor(
    private host: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnChanges(_: SimpleChanges): void {
    this.rebuild();
  }

  ngOnDestroy(): void {
    this.setBodyLock(false);
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.rebuild();
      this.setBodyLock(true);
      this.cdr.markForCheck();
      setTimeout(() => {
        this.attachPanelToBody();
        this.positionDropdown();
        this.searchInput?.nativeElement.focus();
        this.cdr.markForCheck();
      }, 0);
    } else {
      this.query = '';
      this.highlightIndex = -1;
      this.setBodyLock(false);
      this.rebuild();
    }
    this.cdr.markForCheck();
  }

  close(): void {
    this.open = false;
    this.query = '';
    this.setBodyLock(false);
    this.rebuild();
    this.cdr.markForCheck();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;
    const target = event.target as Node;
    if (this.host.nativeElement.contains(target)) return;
    if (this.panelRef?.nativeElement.contains(target)) return;
    this.close();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.open) {
      this.positionDropdown();
      this.cdr.markForCheck();
    }
  }

  onPanelPointer(event: MouseEvent): void {
    event.stopPropagation();
  }

  onQueryChange(q: string): void {
    this.query = q.toUpperCase();
    this.highlightIndex = -1;
    this.rebuild();
    this.cdr.markForCheck();
  }

  onRowSelect(event: MouseEvent, sym: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.select(sym);
  }

  private attachPanelToBody(): void {
    const el = this.panelRef?.nativeElement;
    if (el && el.parentElement !== this.document.body) {
      this.renderer.appendChild(this.document.body, el);
    }
  }

  private setBodyLock(on: boolean): void {
    this.document.body.classList.toggle('symbol-switcher-open', on);
  }

  private positionDropdown(): void {
    const rect = this.triggerBtn?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.dropdownTop = rect.bottom + 4;
    this.dropdownLeft = rect.left;
  }

  private rebuild(): void {
    if (this.query.trim()) {
      const filtered = rankWatchlistSearch(this.watchlist.filter(w => w.enabled), this.query);
      this.flatSymbols = filtered.map(w => w.symbol);
      if (isValidTicker(this.query) && !this.watchlist.some(w => w.symbol === this.query)) {
        this.flatSymbols.unshift(`__ADD__${this.query}`);
      }
      this.sections = [];
    } else {
      this.sections = buildSwitcherSections(
        this.watchlist, this.recentSymbols, this.hotMomentum, this.emergingSetups, this.activeSignals, this.symbol
      );
      this.flatSymbols = this.sections.flatMap(s => s.symbols);
    }
  }

  select(sym: string): void {
    if (sym.startsWith('__ADD__')) {
      this.symbolAdded.emit(sym.replace('__ADD__', ''));
    } else {
      this.symbolSelected.emit(sym);
    }
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.flatSymbols.length) this.highlightIndex = Math.min(this.highlightIndex + 1, this.flatSymbols.length - 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.flatSymbols.length) this.highlightIndex = Math.max(this.highlightIndex - 1, 0);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightIndex >= 0 && this.highlightIndex < this.flatSymbols.length) {
        this.select(this.flatSymbols[this.highlightIndex]);
      } else if (this.query && isValidTicker(this.query)) {
        const sym = this.query.toUpperCase();
        if (this.watchlist.some(w => w.symbol === sym)) this.select(sym);
        else this.select(`__ADD__${sym}`);
      }
    }
  }

  flatIdx(sectionIdx: number, itemIdx: number): number {
    let idx = 0;
    for (let i = 0; i < sectionIdx; i++) idx += this.sections[i].symbols.length;
    return idx + itemIdx;
  }
}

/** Host-level shortcut: focus switcher when / pressed (handled in dashboard) */
export function focusSymbolSwitcher(): void {
  document.querySelector<HTMLButtonElement>('.sym-switcher-trigger')?.click();
}
