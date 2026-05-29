import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SymbolsManagementComponent } from './symbols/symbols-management.component';
import { SignalLabComponent } from './signal-lab/signal-lab.component';
import { AutonomousDiscoveryLabComponent } from './autonomous-discovery/autonomous-discovery-lab.component';
import { ExecutionMonitorComponent } from './execution-monitor/execution-monitor.component';
import { ExecutionConsoleComponent } from './execution-console/execution-console.component';
import { AutonomousExitResearchComponent } from './autonomous-exit-research/autonomous-exit-research.component';
import { ExecutionReviewComponent } from './execution-review/execution-review.component';
import { ResearchHomeComponent } from './research-home/research-home.component';

export const routes: Routes = [
  { path: '', component: ResearchHomeComponent },
  { path: 'replay-lab', component: DashboardComponent },
  { path: 'dashboard', redirectTo: 'replay-lab', pathMatch: 'full' },
  { path: 'symbols', component: SymbolsManagementComponent },
  { path: 'signal-lab', component: SignalLabComponent },
  { path: 'autonomous-discovery', component: AutonomousDiscoveryLabComponent },
  { path: 'execution-monitor', component: ExecutionMonitorComponent },
  { path: 'execution-console', component: ExecutionConsoleComponent },
  { path: 'exit-research', component: AutonomousExitResearchComponent },
  { path: 'execution-review', component: ExecutionReviewComponent }
];
