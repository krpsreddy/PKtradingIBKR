import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SystemStatus } from '../models/system-status.model';

@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './system-status.component.html',
  styleUrl: './system-status.component.scss'
})
export class SystemStatusComponent {
  @Input() status: SystemStatus | null = null;

  statusClass(ok: boolean): string {
    return ok ? 'online' : 'offline';
  }

  label(ok: boolean): string {
    return ok ? 'ONLINE' : 'OFFLINE';
  }

  marketClass(): string {
    return this.status?.marketOpen ? 'market-open' : 'market-closed';
  }
}
