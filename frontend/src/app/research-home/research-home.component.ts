import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResearchModeService } from '../services/research-mode.service';

@Component({
  selector: 'app-research-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './research-home.component.html',
  styleUrl: './research-home.component.scss'
})
export class ResearchHomeComponent {
  constructor(readonly researchMode: ResearchModeService) {}

  enableLiveDebug(): void {
    this.researchMode.setMode('LIVE_DEBUG');
  }
}
