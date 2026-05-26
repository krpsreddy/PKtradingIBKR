import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { DebugPanel } from '../models/system-status.model';

@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [MatExpansionModule, DecimalPipe],
  templateUrl: './debug-panel.component.html',
  styleUrl: './debug-panel.component.scss'
})
export class DebugPanelComponent {
  @Input() debug: DebugPanel | null = null;
  @Input() collapsed = true;
}
