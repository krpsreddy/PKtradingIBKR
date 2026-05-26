import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ExecutionGuidance, SetupCandidate, SetupDeterioration } from '../../models/execution.model';
import { ExecutionSnapshot } from '../../models/refinement.model';
import { rrColorClass, tradeGradeClass } from '../../utils/refinement.util';
import { ProbabilitySparklineComponent } from '../probability-sparkline/probability-sparkline.component';
import { StatisticalConfidence, RankingExplanation } from '../../models/analytics.model';
import { MarketMemoryNarrative, ProbabilisticGuidance } from '../../models/cognition.model';
import { ProbabilisticExecutionSnapshot } from '../../models/probabilistic.model';
import { buildCognitionChips, CognitionChip } from '../../utils/cognition-chips.util';
import { optionsIcon, thetaClass, ivClass } from '../../utils/cognition-icons.util';
import { ExecutionSimulationService, ExecutionSimulation } from '../../services/execution-simulation.service';
import { TOOLTIPS } from '../../utils/micro-tooltips.util';
import { formatOptionsExecution } from '../../utils/options-execution-formatter.util';
import { IntensityMode } from '../../services/situational-intensity.engine';
import { GravitySnapshot } from '../../services/attention-gravity.service';
import { MetricKey, PrioritySnapshot } from '../../services/execution-priority-matrix.service';
import { ExecutionAdvisorySnapshot } from '../../services/signal-intelligence/execution-advisory-analytics.service';
import { ExecutionCoachingPanelComponent } from '../execution-coaching-panel/execution-coaching-panel.component';
import { ExecutionRailBaselineEngine, RailBaselineSnapshot } from '../../services/execution-rail-baseline.engine';
import { TertiaryMetricRecoveryEngine, TertiaryRecoverySnapshot } from '../../services/tertiary-metric-recovery.engine';
import { ExecutionRailCollisionGuardService, RailCollisionSnapshot } from '../../services/execution-rail-collision-guard.service';
import { RailDepthSeparationEngine, RailDepthSnapshot } from '../../services/rail-depth-separation.engine';
import { FooterAtmosphereClampService } from '../../services/footer-atmosphere-clamp.service';
import { FailurePriorityHierarchyEngine, FailureHierarchySnapshot } from '../../services/failure-priority-hierarchy.engine';
import { ReadableTypographyFloorService } from '../../services/readable-typography-floor.service';
import { ExecutionModeService, ExecutionFrameworkMode } from '../../services/signal-intelligence/execution-mode.service';
import { ExecutionPlan } from '../../services/execution-plan/execution-plan.models';

@Component({
  selector: 'app-execution-panel',
  standalone: true,
  imports: [ProbabilitySparklineComponent, DecimalPipe, ExecutionCoachingPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './execution-panel.component.html',
  styleUrl: './execution-panel.component.scss'
})
export class ExecutionPanelComponent {
  @Input() symbol = '';
  @Input() signalType = '';
  @Input() source: SetupCandidate | null = null;
  @Input() guidance: ExecutionGuidance | null = null;
  @Input() executionPlan: ExecutionPlan | null = null;
  @Input() snapshot: ExecutionSnapshot | null = null;
  @Input() deterioration: SetupDeterioration | null = null;
  @Input() probabilistic: ProbabilisticGuidance | null = null;
  @Input() probabilisticExecution: ProbabilisticExecutionSnapshot | null = null;
  @Input() memoryNarrative: MarketMemoryNarrative | null = null;
  @Input() historicalNotes: string[] = [];
  @Input() expanded = false;
  @Input() immersive = false;
  @Input() intensityMode: IntensityMode = 'CALM';
  @Input() gravity: GravitySnapshot | null = null;
  @Input() priority: PrioritySnapshot | null = null;
  @Input() railDim = 1;
  @Input() railLane = false;
  @Input() signalAgeMinutes: number | null = null;
  @Input() rankingNotes: RankingExplanation[] = [];
  @Input() confidence: StatisticalConfidence[] = [];
  @Input() aiLine: string | null = null;
  @Input() advisory: ExecutionAdvisorySnapshot | null = null;

  tertiaryOpen = false;
  govOpen = false;
  accOpen = { analytics: false, historical: false, options: false, memory: false, playbook: false };

  readonly railBaseline: RailBaselineSnapshot;

  constructor(
    private simulationService: ExecutionSimulationService,
    railBaselineEngine: ExecutionRailBaselineEngine,
    private tertiaryRecoveryEngine: TertiaryMetricRecoveryEngine,
    private collisionGuard: ExecutionRailCollisionGuardService,
    private railDepth: RailDepthSeparationEngine,
    private footerAtmosphere: FooterAtmosphereClampService,
    private failureHierarchyEngine: FailurePriorityHierarchyEngine,
    private typographyFloors: ReadableTypographyFloorService,
    private executionMode: ExecutionModeService
  ) {
    this.railBaseline = railBaselineEngine.resolve();
  }

  tertiaryRecovery(): TertiaryRecoverySnapshot {
    return this.tertiaryRecoveryEngine.resolve({
      intensityMode: this.intensityMode,
      immersive: this.immersive,
      railLane: this.railLane
    });
  }

  railDepthLayer(): RailDepthSnapshot {
    return this.railDepth.resolve({ executionRailActive: this.immersive && !this.railLane });
  }

  railDepthVars(): Record<string, string> {
    const atmosphere = this.footerAtmosphere.resolve({ railActive: this.immersive });
    return {
      ...this.railBaseline.cssVars,
      ...this.tertiaryRecovery().cssVars,
      ...this.railCollisionGaps().cssVars,
      ...this.railDepthLayer().cssVars,
      ...atmosphere.cssVars,
      ...this.failureHierarchy().cssVars,
      ...this.typographyFloors.resolve().cssVars
    };
  }

  failureHierarchy(): FailureHierarchySnapshot {
    const exitState = this.probabilisticExecution?.adaptiveExit?.state ?? '';
    return this.failureHierarchyEngine.resolve({
      intensityMode: this.intensityMode,
      exitNow: exitState === 'EXIT_NOW' || exitState.includes('EXIT'),
      exitLabel: this.exitLabel(),
      failPct: this.probabilisticExecution?.failureSignature?.failureProbability ?? 0,
      dominantPath: this.priority?.dominantPath
    });
  }

  primaryRailStyle(): Record<string, string> {
    const secondary = Math.max(0.82, this.railDim);
    return {
      '--rail-attenuation': `${secondary}`,
      '--rail-attenuation-critical': '1',
      '--rail-attenuation-secondary': `${secondary}`,
      '--rail-attenuation-tertiary': '0.62'
    };
  }

  railCollisionGaps(): RailCollisionSnapshot {
    if (!this.executionPlan && !this.guidance) {
      return {
        gapsAfter: {},
        rrRightGutterPx: 10,
        exitReservePx: 0,
        protectedKeys: ['exit', 'stop', 'entry'],
        compressKeys: ['rr', 'dir'],
        cssVars: {}
      };
    }
    return this.collisionGuard.resolve({
      direction: this.footerDirection(),
      metrics: this.metricOrder().map(key => ({
        key,
        labelText: key === 'entry' ? 'Entry' : key === 'stop' ? 'Stop' : key === 'exit' ? 'Exit' : 'RR',
        valueText: key === 'entry' ? this.entryPrice()
          : key === 'stop' ? this.stopPrice()
          : key === 'exit' ? this.exitLabel()
          : this.displayRr(),
        magnet: key === 'entry' ? this.entryMagnet()
          : key === 'stop' ? this.stopMagnet()
          : key === 'exit' ? this.exitMagnet()
          : this.rrMagnet(),
        exitDominant: key === 'exit' ? this.exitDominant() : false
      }))
    });
  }

  gapAfter(key: MetricKey | 'dir'): number | null {
    const gaps = this.railCollisionGaps().gapsAfter;
    return gaps[key] ?? null;
  }

  rrGutter(): number {
    return this.railCollisionGaps().rrRightGutterPx;
  }

  toggleAcc(key: keyof typeof this.accOpen): void {
    this.accOpen[key] = !this.accOpen[key];
  }

  optionsExec() {
    return formatOptionsExecution(this.probabilisticExecution?.optionsExecution);
  }

  dnaShort(): string {
    const d = this.dnaLabel();
    if (d === '—') return '—';
    return d.length > 14 ? d.slice(0, 12) + '…' : d;
  }

  ivShort(): string {
    const o = this.options();
    if (!o) return '—';
    if (o.ivRisk === 'EXPANDING') return 'EXP';
    if (o.ivRisk === 'CRUSH_RISK') return 'CRUSH';
    return 'STBL';
  }

  thetaShort(): string {
    const t = this.thetaLabel();
    if (t === 'EXTREME') return 'EXT';
    if (t === 'HIGH') return 'HIGH';
    if (t === 'MEDIUM') return 'MED';
    return t === '—' ? '—' : 'LOW';
  }

  simulation(): ExecutionSimulation | null {
    return this.simulationService.simulate(this.probabilisticExecution);
  }

  calmDisciplineMessage(): string | null {
    const raw = this.preservationMessage();
    if (!raw) return null;
    const m = (this.preservationMode() ?? '').toUpperCase();
    if (m.includes('PRESERVE') || m.includes('NO_EDGE')) {
      return 'DISCIPLINED WAIT · WAITING FOR HIGH-CONVICTION EXPANSION';
    }
    if (m.includes('WAIT') || m.includes('DO_NOTHING')) {
      return 'NO CLEAN EDGE RIGHT NOW';
    }
    return raw;
  }

  gradeClass(): string {
    return tradeGradeClass(this.snapshot?.tradeQualityGrade);
  }

  tradeGrade(): string {
    return this.snapshot?.tradeQualityGrade ?? '—';
  }

  displayRr(): string {
    const rr = this.executionPlan?.riskReward;
    return rr != null ? `${rr}` : '—';
  }

  rrClass(): string {
    const q = this.executionPlan?.metadata?.['rrQuality'] as string | undefined;
    return rrColorClass(q ?? null);
  }

  noEdgeBanner(): string | null {
    if (this.snapshot?.noEdge) return this.snapshot.noEdgeMessage ?? 'NO EDGE';
    return null;
  }

  displaySignalType(): string {
    return this.signalType ? this.signalType.replace(/_/g, ' ') : '—';
  }

  exitLabel(): string {
    const fromPlan = this.executionPlan?.guidance.exitLabel;
    if (fromPlan?.length) return fromPlan;
    return 'HOLD';
  }

  footerDirection(): string {
    const fromPlan = this.executionPlan?.guidance.suggestedDirection;
    if (fromPlan) return fromPlan;
    if (this.executionPlan?.direction === 'LONG') return 'CALLS';
    if (this.executionPlan?.direction === 'SHORT') return 'PUTS';
    return '—';
  }

  trustScore(): number | null {
    return this.probabilisticExecution?.marketTrust?.score ?? null;
  }

  failPct(): number | null {
    return this.probabilisticExecution?.failureSignature?.failureProbability ?? null;
  }

  halfLifeMin(): number | null {
    return this.probabilisticExecution?.halfLife?.halfLifeMinutes ?? null;
  }

  expectedMoveLabel(): string {
    const em = this.probabilisticExecution?.expectedMove;
    if (!em) return '—';
    if (em.typicalMoveLowPercent != null && em.typicalMoveHighPercent != null) {
      return `${em.typicalMoveLowPercent}–${em.typicalMoveHighPercent}%`;
    }
    return em.averageContinuationPercent != null ? `${em.averageContinuationPercent}%` : '—';
  }

  dnaLabel(): string {
    return this.probabilisticExecution?.setupDna?.personality ?? '—';
  }

  whyNowHeadline(): string {
    const fromPlan = this.executionPlan?.guidance.whyNow?.[0];
    if (fromPlan) return fromPlan;
    return this.probabilisticExecution?.whyNow?.headline ?? '—';
  }

  maturityLabel(): string {
    return this.probabilisticExecution?.setupMaturity?.label ?? '—';
  }

  chips(): CognitionChip[] {
    const g = this.executionPlan?.guidance;
    const base = buildCognitionChips({
      entryQuality: g?.entryQuality ?? this.guidance?.entryQuality,
      extended: this.source?.extended,
      freshness: this.source?.freshness,
      relativeVolume: this.source?.relativeVolume,
      failurePct: this.failPct(),
      rr: this.executionPlan?.riskReward ?? null,
      halfLifeMin: this.halfLifeMin(),
      maturity: this.probabilisticExecution?.setupMaturity?.stage,
      deteriorationReasons: this.deterioration?.reasons,
      warnings: g?.warnings ?? this.guidance?.warnings
    });
    const o = this.options();
    if (o?.thetaRisk === 'HIGH' || o?.thetaRisk === 'EXTREME') {
      base.unshift({ label: 'THETA ' + o.thetaRisk, tone: 'risk' });
    }
    if (o?.ivRisk === 'EXPANDING') base.unshift({ label: 'IV EXPAND', tone: 'positive' });
    if (o?.ivRisk === 'CRUSH_RISK') base.unshift({ label: 'IV CRUSH', tone: 'risk' });
    if (this.guidance?.entryQuality === 'LATE') base.unshift({ label: 'LATE ENTRY', tone: 'risk' });
    const adv = this.advisory;
    const decision = adv?.liveDecision;
    if (decision) {
      const tone = decision.decision === 'FULL_EXECUTION' ? 'positive'
        : decision.decision.includes('AVOID') || decision.decision === 'TRAP_RISK' ? 'risk' : 'neutral';
      base.unshift({ label: decision.decisionLabel, tone });
      return base.slice(0, 5);
    }
    if (adv?.falseBreakout?.label) {
      const tone = adv.falseBreakout.trapRisk === 'HIGH' ? 'risk' : adv.falseBreakout.trapRisk === 'LOW' ? 'positive' : 'neutral';
      base.unshift({ label: adv.falseBreakout.label, tone });
    }
    if (adv?.openingDrive?.label && adv.openingDrive.openingDriveType !== 'NEUTRAL') {
      const openTone = adv.openingDrive.openingDriveType.includes('TRAP') || adv.openingDrive.openingDriveType.includes('FADE')
        ? 'risk' : 'positive';
      base.unshift({ label: adv.openingDrive.label, tone: openTone });
    }
    const seq = this.entrySequencingIntel();
    if (seq?.compactLine) {
      const tone = seq.currentState === 'SECOND_LEG_CONFIRMED' || seq.currentState === 'CONTINUATION_ACCEPTED' ? 'positive'
        : seq.fakeoutRisk === 'HIGH' ? 'risk' : 'neutral';
      base.unshift({ label: seq.compactLine, tone });
    } else {
      const eq = this.executionQualityIntel();
      if (eq?.compactLine) {
        const tone = eq.classification === 'IDEAL' || eq.classification === 'RECLAIM_CONFIRMED' ? 'positive'
          : eq.classification.includes('TRAP') || eq.classification === 'EXHAUSTED' ? 'risk' : 'neutral';
        base.unshift({ label: eq.compactLine, tone });
      }
    }
    const live = adv?.liveGate;
    if (live?.governance) {
      const g = live.governance;
      const tone = g.state === 'ALLOW' ? 'positive'
        : g.state === 'TOXIC' || g.state === 'SUPPRESS' ? 'risk' : 'neutral';
      base.unshift({ label: governanceLabelFromState(g.state), tone });
    } else if (live?.label) {
      const tone = live.state === 'EDGE_ACTIVE' ? 'positive'
        : live.state === 'TOXIC' || live.state === 'NO_EDGE' ? 'risk' : 'neutral';
      base.unshift({ label: live.label, tone });
    } else {
      const gate = adv?.discoveryGate ?? adv?.edgeGate;
      if (gate?.label && gate.state !== 'EDGE_ACTIVE') {
        base.unshift({ label: gate.label, tone: 'risk' });
      } else if (gate?.state === 'EDGE_ACTIVE') {
        base.unshift({ label: 'EDGE ACTIVE', tone: 'positive' });
      }
    }
    return base.slice(0, 10);
  }

  exhaustionSeries(): number[] {
    const pd = this.probabilisticExecution?.probabilityDecay;
    if (!pd?.trend?.length) return [];
    const base = pd.exhaustionProbability;
    return pd.trend.map((_, i, arr) => base * (i + 1) / arr.length);
  }

  formatLabel(value: string | undefined): string {
    if (!value) return '—';
    return value.replace(/_/g, ' ');
  }

  tip(key: keyof typeof TOOLTIPS): string {
    return TOOLTIPS[key];
  }

  options() {
    return this.probabilisticExecution?.optionsExecution ?? null;
  }

  strikeLabel(): string {
    const o = this.options();
    if (!o) return '—';
    const t = o.recommendedStrikeType?.replace(/_/g, ' ') ?? 'ATM';
    return t.includes('ITM') ? 'Slight ITM' : t.includes('AVOID') ? 'Avoid OTM' : 'ATM';
  }

  premiumLabel(): string {
    const o = this.options();
    if (!o) return '—';
    return o.expectedPremiumExpansion ?? o.expectedPremiumDeterioration ?? '—';
  }

  thetaLabel(): string {
    return this.options()?.thetaRisk ?? '—';
  }

  ivLabel(): string {
    const o = this.options();
    if (!o) return '—';
    if (o.ivRisk === 'EXPANDING') return 'EXPAND';
    if (o.ivRisk === 'CRUSH_RISK') return 'CRUSH';
    return 'STABLE';
  }

  holdLabel(): string {
    const o = this.options();
    if (!o?.holdWindow) return '—';
    return o.holdWindow.replace(' optimal', '');
  }

  thetaTone(): string {
    return thetaClass(this.options()?.thetaRisk);
  }

  ivTone(): string {
    return ivClass(this.options()?.ivRisk);
  }

  optIcon(field: string): string {
    return optionsIcon(field);
  }

  preservationMode(): string | null {
    const m = this.options()?.capitalPreservation?.mode;
    return m && m !== 'CLEAR' ? m : null;
  }

  preservationMessage(): string | null {
    return this.options()?.capitalPreservation?.message ?? null;
  }

  showOptionsRow(): boolean {
    return !!this.options() && this.guidance != null;
  }

  entryPrice(): string {
    const p = this.executionPlan?.entryZone.ideal ?? this.executionPlan?.entryZone.low;
    return p != null ? `$${p.toFixed(2)}` : '—';
  }

  stopPrice(): string {
    const p = this.executionPlan?.stopZone.price;
    return p != null ? `$${p.toFixed(2)}` : '—';
  }

  targetPrice(): string {
    const p = this.executionPlan?.targetZone.primary;
    return p != null ? `$${p.toFixed(2)}` : '—';
  }

  private estimatedRr(): number | null {
    return this.executionPlan?.riskReward ?? null;
  }

  metricOrder(): MetricKey[] {
    return this.priority?.metricOrder ?? ['entry', 'stop', 'exit', 'rr'];
  }

  entryMagnet(): boolean {
    if (this.failureHierarchy().entrySuppressed) return false;
    const g = this.gravity?.weights.entry ?? 0;
    return g >= 0.72 || this.intensityMode === 'BREAKOUT' || this.intensityMode === 'TRIGGER';
  }

  stopMagnet(): boolean {
    const fh = this.failureHierarchy();
    if (fh.exitDominant) return false;
    const g = this.gravity?.weights.stop ?? 0;
    return g >= 0.72 || this.intensityMode === 'FAILURE'
      || (this.probabilisticExecution?.failureSignature?.failureProbability ?? 0) >= 25;
  }

  stopSecondary(): boolean {
    return this.failureHierarchy().stopSecondary;
  }

  exitMagnet(): boolean {
    const fh = this.failureHierarchy();
    if (fh.exitDominant) return true;
    const g = this.gravity?.weights.exit ?? 0;
    return g >= 0.72 || this.probabilisticExecution?.adaptiveExit?.state?.includes('EXIT') === true;
  }

  exitDominant(): boolean {
    return this.failureHierarchy().exitDominant;
  }

  rrMagnet(): boolean {
    if (this.failureHierarchy().rrSuppressed) return false;
    const g = this.gravity?.weights.rr ?? 0;
    return g >= 0.65 || ((this.estimatedRr() ?? 0) >= 2);
  }

  failMagnet(): boolean {
    return (this.gravity?.weights.fail ?? 0) >= 0.75;
  }

  liveGate() {
    return this.advisory?.liveGate ?? null;
  }

  lifecycleCoach() {
    return this.advisory?.lifecycleCoach ?? null;
  }

  continuationPromotionLine(): string | null {
    const promo = this.liveDecision()?.continuationPromotion;
    if (!promo?.active) return null;
    return promo.suppressionOverride || promo.promotionReason;
  }

  openingExpansionLine(): string | null {
    const exp = this.liveDecision()?.openingExpansion;
    if (!exp?.active || !exp.entryType) return null;
    return exp.promotionReason;
  }

  continuationParticipationLine(): string | null {
    const p = this.liveDecision()?.continuationParticipation;
    if (!p?.active || !p.signalType) return null;
    return p.promotionReason;
  }

  autonomousExecutionLine(): string | null {
    const a = this.liveDecision()?.autonomousExecution;
    if (!a?.active || !a.entryType) return null;
    return a.promotionReason;
  }

  liveRegimeLine(): string | null {
    const r = this.liveDecision()?.liveRegime;
    if (!r?.active || !r.classification) return null;
    return r.promotionReason;
  }

  executionTriggerCard() {
    const t = this.liveDecision()?.executionTrigger;
    if (!t?.active) return null;
    return t;
  }

  executionTriggerActionLabel(): string | null {
    const t = this.executionTriggerCard();
    if (!t) return null;
    return t.traderAction.replace(/_/g, ' ');
  }

  executionTriggerRvol(): string {
    const t = this.executionTriggerCard();
    if (!t) return '—';
    const est = (t.metrics.continuationVelocity / 22).toFixed(1);
    return `${est}x`;
  }

  legacyComparisonLine(): string | null {
    const legacy = this.liveDecision()?.legacyDecision;
    if (!legacy || !this.executionMode.isHybrid()) return null;
    return `Legacy: ${legacy.compactLine}`;
  }

  executionFrameworkMode(): ExecutionFrameworkMode {
    return this.liveDecision()?.executionFrameworkMode ?? this.executionMode.mode();
  }

  setExecutionMode(mode: ExecutionFrameworkMode): void {
    this.executionMode.setMode(mode);
  }

  liveDecision() {
    return this.advisory?.liveDecision ?? null;
  }

  decisionFeedbackIntel() {
    return this.advisory?.decisionFeedbackIntel ?? null;
  }

  marketStateIntel() {
    return this.advisory?.marketStateIntel ?? null;
  }

  narrativeRailLine(): string | null {
    return this.marketStateIntel()?.compactLine ?? null;
  }

  narrativeTrajectoryLabel(): string | null {
    return this.marketStateIntel()?.trajectoryLabel ?? null;
  }

  adaptiveInsightLine(): string | null {
    return this.decisionFeedbackIntel()?.adaptiveInsightLine ?? null;
  }

  adaptiveEntryIntel() {
    return this.advisory?.adaptiveEntryIntel ?? null;
  }

  adaptiveEntryLine(): string | null {
    return this.adaptiveEntryIntel()?.guidanceLine ?? null;
  }

  adaptiveCalibrationIntel() {
    return this.advisory?.adaptiveCalibrationIntel ?? null;
  }

  calibrationLine(): string | null {
    return this.adaptiveCalibrationIntel()?.guidanceLine ?? null;
  }

  entrySequencingIntel() {
    return this.advisory?.entrySequencingIntel ?? null;
  }

  executionQualityIntel() {
    return this.advisory?.executionQualityIntel ?? null;
  }

  /** Single actionable decision line for execution rail. */
  executionRailLine(): string | null {
    const auto = this.liveDecision()?.autonomousExecution;
    if (auto?.active && auto.entryType) {
      return `${auto.entryType.replace(/_/g, ' ')} · ${auto.promotionReason}`;
    }
    const trigger = this.liveDecision()?.executionTrigger;
    if (trigger?.active && trigger.entryType && trigger.traderAction !== 'DO_NOT_CHASE') {
      return `${trigger.traderAction.replace(/_/g, ' ')} · ${trigger.triggerReason}`;
    }
    const regime = this.liveDecision()?.liveRegime;
    if (regime?.active && regime.participationOpportunity) {
      return `${regime.classification?.replace(/_/g, ' ') ?? 'Regime'} · ${regime.promotionReason}`;
    }
    const part = this.liveDecision()?.continuationParticipation;
    if (part?.active && part.signalType) {
      return `${part.signalType.replace(/_/g, ' ')} · ${part.promotionReason}`;
    }
    const opening = this.liveDecision()?.openingExpansion;
    if (opening?.active && opening.entryType) {
      return `${opening.entryType.replace(/_/g, ' ')} · ${opening.promotionReason}`;
    }
    const promo = this.liveDecision()?.continuationPromotion;
    if (promo?.active && promo.continuationEntryType) {
      return `${promo.continuationEntryType.replace(/_/g, ' ')} · ${promo.promotionReason}`;
    }
    return this.narrativeRailLine()
      ?? this.liveDecision()?.compactLine
      ?? this.entrySequencingIntel()?.compactLine
      ?? this.executionQualityIntel()?.compactLine
      ?? null;
  }

  executionQualityLine(): string | null {
    return this.executionRailLine();
  }

  decisionClass(): string {
    const ld = this.liveDecision();
    if (ld?.autonomousExecution?.active) return 'eq-ideal eq-autonomous';
    if (ld?.executionTrigger?.active && ld.executionTrigger.entryType) return 'eq-ideal eq-trigger';
    if (ld?.continuationParticipation?.active) return 'eq-ideal eq-participation';
    if (ld?.liveRegime?.participationOpportunity) return 'eq-ideal eq-live-regime';
    if (ld?.openingExpansion?.active) return 'eq-ideal eq-opening-expansion';
    if (ld?.continuationPromotion?.active) return 'eq-ideal eq-promoted';
    const d = ld?.decision ?? '';
    if (d === 'FULL_EXECUTION' || d === 'PROBING_EXECUTION') return 'eq-ideal';
    if (d.includes('WAIT')) return 'eq-wait';
    if (d === 'TRAP_RISK' || d === 'AVOID_TRADE' || d === 'AVOID_CHASE') return 'eq-toxic';
    if (d === 'REDUCE_SIZE') return 'eq-warn';
    return this.executionQualityClass();
  }

  executionQualityClass(): string {
    if (this.liveDecision()) return this.decisionClass();
    const seq = this.entrySequencingIntel();
    if (seq) {
      const s = seq.currentState;
      if (s === 'SECOND_LEG_CONFIRMED' || s === 'CONTINUATION_ACCEPTED' || s === 'RECLAIM_CONFIRMED') return 'eq-ideal';
      if (s === 'WAITING_FOR_ACCEPTANCE' || s === 'PULLBACK_STABILIZING' || s === 'RECLAIM_IN_PROGRESS') return 'eq-wait';
      if (s === 'FAILED_ACCEPTANCE' || s === 'LIQUIDITY_SWEEP' || s === 'REJECTED' || s === 'EXHAUSTING') return 'eq-toxic';
      if (s === 'OVEREXTENDED' || s === 'EARLY_EXTENSION') return 'eq-warn';
      return 'eq-neutral';
    }
    const c = this.executionQualityIntel()?.classification ?? '';
    if (c === 'IDEAL' || c === 'RECLAIM_CONFIRMED') return 'eq-ideal';
    if (c === 'ACCEPTABLE' || c === 'EARLY_PROBE') return 'eq-wait';
    if (c.includes('TRAP') || c.includes('SWEEP') || c === 'EXHAUSTED') return 'eq-toxic';
    if (c === 'CHASE' || c === 'EXTENDED') return 'eq-warn';
    return 'eq-neutral';
  }

  liveGateBannerClass(): string {
    const gov = this.liveGate()?.governance?.state;
    if (gov === 'ALLOW') return 'gate-active';
    if (gov === 'TOXIC' || gov === 'SUPPRESS') return 'gate-toxic';
    if (gov === 'REDUCE_SIZE') return 'gate-reduce';
    const s = this.liveGate()?.state;
    if (s === 'EDGE_ACTIVE') return 'gate-active';
    if (s === 'TOXIC' || s === 'NO_EDGE') return 'gate-toxic';
    if (s === 'REDUCE_SIZE') return 'gate-reduce';
    return 'gate-selective';
  }

  governanceLabel(): string {
    const g = this.liveGate()?.governance;
    if (!g) return '—';
    switch (g.state) {
      case 'ALLOW': return 'FULL EDGE';
      case 'SELECTIVE': return 'SELECTIVE';
      case 'REDUCE_SIZE': return 'REDUCE SIZE';
      case 'SUPPRESS': return 'SUPPRESS';
      case 'TOXIC': return 'TOXIC ENVIRONMENT';
    }
  }

  governanceClass(): string {
    const s = this.liveGate()?.governance?.state;
    if (s === 'ALLOW') return 'gov-full';
    if (s === 'TOXIC' || s === 'SUPPRESS') return 'gov-toxic';
    if (s === 'REDUCE_SIZE') return 'gov-reduce';
    return 'gov-selective';
  }

  execQualityLabels(): string[] {
    const ld = this.liveDecision();
    if (ld) return [ld.decisionLabel, ld.conviction.label.replace(' CONVICTION', ''), ld.riskLabel];
    const seq = this.entrySequencingIntel();
    if (seq?.compactLine) return [seq.compactLine];
    const eq = this.executionQualityIntel();
    if (eq?.compactLine) return [eq.compactLine];
    return this.liveGate()?.executionQuality?.labels ?? [];
  }

  matrixStatusClass(status: string): string {
    const good = ['GOOD', 'ALIGNED', 'FAVORABLE', 'STRONG', 'LOW'];
    const bad = ['WEAK', 'UNFAVORABLE', 'POOR', 'HIGH'];
    if (good.includes(status)) return 'good';
    if (bad.includes(status)) return 'bad';
    return 'neutral';
  }
}

function governanceLabelFromState(state: string): string {
  switch (state) {
    case 'ALLOW': return 'FULL EDGE';
    case 'SELECTIVE': return 'SELECTIVE';
    case 'REDUCE_SIZE': return 'REDUCE SIZE';
    case 'SUPPRESS': return 'SUPPRESS';
    case 'TOXIC': return 'TOXIC ENVIRONMENT';
    default: return state.replace(/_/g, ' ');
  }
}
