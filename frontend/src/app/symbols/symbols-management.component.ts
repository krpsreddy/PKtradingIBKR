import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { TradingSymbolService } from '../services/trading-symbol.service';
import { CreateTradingSymbolRequest, SYMBOL_GROUPS, TradingSymbol } from '../models/trading-symbol.model';
import { AddSymbolDialogComponent } from './add-symbol-dialog.component';

@Component({
  selector: 'app-symbols-management',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DragDropModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSelectModule
  ],
  templateUrl: './symbols-management.component.html',
  styleUrl: './symbols-management.component.scss'
})
export class SymbolsManagementComponent implements OnInit, OnDestroy {
  symbols: TradingSymbol[] = [];
  groups = SYMBOL_GROUPS;
  displayedColumns = ['drag', 'symbol', 'group', 'watchlist', 'scan', 'live', 'preload', 'enabled', 'pinned', 'actions'];
  loading = false;
  private refresh$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private tradingSymbolService: TradingSymbolService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.refresh$.pipe(
      switchMap(() => {
        this.loading = true;
        return this.tradingSymbolService.getSymbolsConfig();
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: list => {
        this.symbols = [...list].sort((a, b) => a.displayOrder - b.displayOrder);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
    this.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    this.refresh$.next();
  }

  openAddDialog(): void {
    const ref = this.dialog.open(AddSymbolDialogComponent, { width: '420px', data: {} });
    ref.afterClosed().subscribe((payload: CreateTradingSymbolRequest | undefined) => {
      if (!payload) return;
      this.tradingSymbolService.createSymbol(payload).subscribe(() => this.refresh());
    });
  }

  toggleScan(row: TradingSymbol): void {
    this.tradingSymbolService.toggleScan(row.symbol).subscribe(() => this.refresh());
  }

  toggleLive(row: TradingSymbol): void {
    this.tradingSymbolService.toggleLive(row.symbol).subscribe(() => this.refresh());
  }

  togglePreload(row: TradingSymbol): void {
    this.tradingSymbolService.updateSymbol(row.symbol, { preloadOnStartup: !row.preloadOnStartup })
      .subscribe(() => this.refresh());
  }

  toggleEnabled(row: TradingSymbol): void {
    this.tradingSymbolService.updateSymbol(row.symbol, { enabled: !row.enabled })
      .subscribe(() => this.refresh());
  }

  togglePinned(row: TradingSymbol): void {
    this.tradingSymbolService.updateSymbol(row.symbol, { pinned: !row.pinned })
      .subscribe(() => this.refresh());
  }

  updateGroup(row: TradingSymbol, groupName: string): void {
    this.tradingSymbolService.updateSymbol(row.symbol, { groupName }).subscribe(() => this.refresh());
  }

  addToWatchlist(row: TradingSymbol): void {
    this.tradingSymbolService.addToWatchlist(row.symbol).subscribe(() => this.refresh());
  }

  removeFromWatchlist(row: TradingSymbol): void {
    this.tradingSymbolService.removeFromWatchlist(row.symbol).subscribe(() => this.refresh());
  }

  remove(row: TradingSymbol): void {
    this.tradingSymbolService.deleteSymbol(row.symbol).subscribe(() => this.refresh());
  }

  drop(event: CdkDragDrop<TradingSymbol[]>): void {
    moveItemInArray(this.symbols, event.previousIndex, event.currentIndex);
    this.tradingSymbolService.reorder(this.symbols.map(s => s.symbol)).subscribe();
  }
}
