import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SymbolsManagementComponent } from './symbols/symbols-management.component';
import { SignalLabComponent } from './signal-lab/signal-lab.component';
import { AutonomousDiscoveryLabComponent } from './autonomous-discovery/autonomous-discovery-lab.component';
import { ExecutionMonitorComponent } from './execution-monitor/execution-monitor.component';
import { ExecutionConsoleComponent } from './execution-console/execution-console.component';
import { AutonomousExitResearchComponent } from './autonomous-exit-research/autonomous-exit-research.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'symbols', component: SymbolsManagementComponent },
  { path: 'signal-lab', component: SignalLabComponent },
  { path: 'autonomous-discovery', component: AutonomousDiscoveryLabComponent },
  { path: 'execution-monitor', component: ExecutionMonitorComponent },
  { path: 'execution-console', component: ExecutionConsoleComponent },
  { path: 'exit-research', component: AutonomousExitResearchComponent }
];
