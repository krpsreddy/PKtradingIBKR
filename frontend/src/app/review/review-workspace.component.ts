import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { SignalTableComponent } from '../signals/signal-table.component';
import { TradeJournalPanelComponent } from '../components/trade-journal-panel/trade-journal-panel.component';
import { MyEdgePanelComponent } from '../components/my-edge-panel/my-edge-panel.component';
import { PlaybookBrowserComponent } from '../components/playbook-browser/playbook-browser.component';
import { SessionReviewComponent } from '../components/session-review/session-review.component';
import { SignalIntelligencePanelComponent } from '../components/signal-intelligence-panel/signal-intelligence-panel.component';
import { PerformanceHeatmapComponent } from '../components/performance-heatmap/performance-heatmap.component';
import { IntelligenceStreamComponent } from '../components/intelligence-stream/intelligence-stream.component';
import { TraderStateComponent } from '../components/trader-state/trader-state.component';
import { RankingExplainComponent } from '../components/ranking-explain/ranking-explain.component';
import { CoachingFeedComponent } from '../components/coaching-feed/coaching-feed.component';
import { AiCoachingPanelComponent } from '../components/ai-coaching-panel/ai-coaching-panel.component';
import { GlobalEdgeLabComponent } from '../components/global-edge-lab/global-edge-lab.component';
import { SymbolDnaPanelComponent } from '../components/symbol-dna-panel/symbol-dna-panel.component';
import { SignalExplorerPanelComponent } from '../components/signal-explorer-panel/signal-explorer-panel.component';
import { AnalyticsQueryWorkbenchComponent } from '../components/analytics-query-workbench/analytics-query-workbench.component';
import { PlaybookLabComponent } from '../components/playbook-lab/playbook-lab.component';
import { TradeLifecycleLabComponent } from '../components/trade-lifecycle-lab/trade-lifecycle-lab.component';
import { EdgeRefinementLabComponent } from '../components/edge-refinement-lab/edge-refinement-lab.component';
import {
  BehaviorInsight,
  Playbook,
  RankingExplanation,
  SessionReview,
  TraderEdge
} from '../models/analytics.model';
import {
  AiSessionReview,
  CognitionSnapshot,
  CoachingFeedItem,
  IntelligenceSummary
} from '../models/cognition.model';
import { SignalEdgeIntelligenceSnapshot } from '../models/signal-intelligence.model';
import { TradeJournalEntry } from '../models/refinement.model';
import { MarketTrend } from '../models/workspace.model';
import { TradingSignal } from '../models/signal.model';
import { ReviewTabId } from '../services/workspace-mode.service';
import { TraderOperatingModeService } from '../services/trader-operating-mode.service';

@Component({
  selector: 'app-review-workspace',
  standalone: true,
  imports: [
    SignalIntelligencePanelComponent,
    SessionReviewComponent,
    TradeJournalPanelComponent,
    MyEdgePanelComponent,
    PlaybookBrowserComponent,
    PerformanceHeatmapComponent,
    IntelligenceStreamComponent,
    TraderStateComponent,
    RankingExplainComponent,
    CoachingFeedComponent,
    AiCoachingPanelComponent,
    SymbolDnaPanelComponent,
    GlobalEdgeLabComponent,
    PlaybookLabComponent,
    TradeLifecycleLabComponent,
    EdgeRefinementLabComponent,
    SignalTableComponent,
    SignalExplorerPanelComponent,
    AnalyticsQueryWorkbenchComponent
  ],
  templateUrl: './review-workspace.component.html',
  styleUrl: './review-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewWorkspaceComponent {
  constructor(
    private cdr: ChangeDetectorRef,
    private traderMode: TraderOperatingModeService
  ) {}

  @Input() symbol = 'NVDA';
  @Input() watchlist: string[] = [];
  @Input() signals: TradingSignal[] = [];
  @Input() marketTrend: MarketTrend | null = null;
  @Input() regimeWinRates: Record<string, number> = {};
  @Input() signalAnalytics: SignalEdgeIntelligenceSnapshot | null = null;
  @Input() sessionReview: SessionReview | null = null;
  @Input() sessionReviewLoading = false;
  @Input() behavior: BehaviorInsight[] = [];
  @Input() cognition: CognitionSnapshot | null = null;
  @Input() traderEdge: TraderEdge | null = null;
  @Input() playbooks: Playbook[] = [];
  @Input() journalEntries: TradeJournalEntry[] = [];
  @Input() rankingNotes: RankingExplanation[] = [];
  @Input() selectedSignalType: string | null = null;
  @Input() emptySignals: { title: string; detail: string } = { title: 'No opportunities', detail: '' };
  @Input() set initialTab(tab: ReviewTabId | null) {
    if (tab) this.activeTab = tab;
  }
  @Input() edgeLabInitialTab: import('../components/global-edge-lab/global-edge-lab.component').EdgeLabTab | null = null;
  @Input() edgeLabFocusSymbol: string | null = null;

  @Output() journalSave = new EventEmitter<TradeJournalEntry>();
  @Output() journalReview = new EventEmitter<TradeJournalEntry>();
  @Output() signalSelected = new EventEmitter<TradingSignal>();
  @Output() symbolSelect = new EventEmitter<string>();

  activeTab: ReviewTabId = 'intelligence';

  readonly tabs: { id: ReviewTabId; label: string }[] = [
    { id: 'intelligence', label: 'Execution Intelligence' },
    { id: 'edge-lab', label: 'Autonomous Edge Lab' },
    { id: 'symbol-dna', label: 'Autonomous Symbol Profile' },
    { id: 'session', label: 'Regime Session Review' },
    { id: 'journal', label: 'Journal' },
    { id: 'edge', label: 'Execution Edge' },
    { id: 'coaching', label: 'Coaching' },
    { id: 'playbooks', label: 'Autonomous Playbooks' },
    { id: 'playbook-lab', label: 'Strategy Research Lab' },
    { id: 'trade-timeline', label: 'Execution Timeline' },
    { id: 'edge-refinement', label: 'Regime Refinement' },
    { id: 'signal-explorer', label: 'Opportunity Explorer' },
    { id: 'analytics-query', label: 'Autonomous Analytics' },
    { id: 'history', label: 'Execution History' }
  ];

  get visibleTabs(): { id: ReviewTabId; label: string }[] {
    return this.tabs.filter(t => this.traderMode.shouldShowReviewTab(t.id));
  }

  selectTab(id: ReviewTabId): void {
    if (id === 'symbol-edge') {
      this.activeTab = 'symbol-dna';
      return;
    }
    if (id === 'edge-discovery') {
      this.activeTab = 'edge-lab';
      return;
    }
    this.activeTab = id;
  }

  onOpenSymbolDna(sym: string): void {
    this.symbolSelect.emit(sym);
    this.activeTab = 'symbol-dna';
    this.cdr.markForCheck();
  }

  aiReview(): AiSessionReview | null {
    return this.cognition?.aiSessionReview ?? null;
  }

  summary(): IntelligenceSummary | null {
    return this.cognition?.summary ?? null;
  }

  coachingFeed(): CoachingFeedItem[] {
    return this.cognition?.coachingFeed ?? [];
  }
}
