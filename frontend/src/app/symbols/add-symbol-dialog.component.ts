import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SYMBOL_GROUPS } from '../models/trading-symbol.model';

export interface AddSymbolDialogData {
  symbol?: string;
}

@Component({
  selector: 'app-add-symbol-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>Add Trading Symbol</h2>
    <div mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Symbol</mat-label>
          <input matInput formControlName="symbol" placeholder="AAPL" autocomplete="off" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Group</mat-label>
          <mat-select formControlName="groupName">
            @for (g of groups; track g) {
              <mat-option [value]="g">{{ g }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle formControlName="scanEnabled">Scanner enabled</mat-slide-toggle>
        <mat-slide-toggle formControlName="subscribeLive">Live streaming</mat-slide-toggle>
        <mat-slide-toggle formControlName="preloadOnStartup">Preload on startup</mat-slide-toggle>
        <mat-slide-toggle formControlName="enabled">Enabled</mat-slide-toggle>
      </form>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">Add to Watchlist</button>
    </div>
  `,
  styles: [`
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 320px;
      padding-top: 8px;
    }
    mat-slide-toggle { margin: 2px 0; }
  `]
})
export class AddSymbolDialogComponent {
  groups = SYMBOL_GROUPS;
  form;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddSymbolDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddSymbolDialogData | null
  ) {
    this.form = this.fb.group({
      symbol: [data?.symbol ?? '', [Validators.required, Validators.pattern(/^[A-Za-z][A-Za-z0-9.-]{0,9}$/)]],
      groupName: ['Momentum', Validators.required],
      scanEnabled: [true],
      subscribeLive: [true],
      preloadOnStartup: [true],
      enabled: [true]
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      symbol: v.symbol!.toUpperCase(),
      groupName: v.groupName!,
      scanEnabled: v.scanEnabled!,
      subscribeLive: v.subscribeLive!,
      preloadOnStartup: v.preloadOnStartup!,
      enabled: v.enabled!
    });
  }
}
