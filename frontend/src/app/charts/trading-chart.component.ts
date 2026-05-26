import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  CandlestickData,
  ColorType,
  CrosshairMode,
  HistogramData,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineData,
  SeriesMarker,
  Time,
  createChart
} from 'lightweight-charts';
import { Candle } from '../models/candle.model';
import { TradingSignal } from '../models/signal.model';
import { IndicatorSnapshot } from '../models/indicator.model';
import { TrendShade } from '../models/workspace.model';
import { ReplaySignalEvent } from '../models/replay.model';
import { ChartExecutionLevel, TradeStructureOverlay } from '../models/execution.model';
import { ChartLiveStateService, ChartAnchorState } from '../services/chart-live-state.service';
import { LabelCollisionService, LabelLayout } from '../services/label-collision.service';
import { AxisLabelResolutionService, ResolvedAxisLabel } from '../services/axis-label-resolution.service';
import { OverlayStackLayoutEngine, StackLayoutItem } from '../services/overlay-stack-layout.engine';
import { CognitionBreathingEngine } from '../services/cognition-breathing.engine';
import { CognitionSafeZoneService, CognitionSafeZoneSnapshot } from '../services/cognition-safe-zone.service';
import { AdaptiveScaleDensityService, ScaleDensitySnapshot } from '../services/adaptive-scale-density.service';
import { FooterAtmosphereClampService } from '../services/footer-atmosphere-clamp.service';
import { ExecutionAnnotationLaneService } from '../services/execution-annotation-lane.service';
import { TriggerLine } from '../services/trigger-line-overlay.service';
import { ChartCognitionPill } from '../utils/chart-cognition-pills.util';
import { FocusPulseMode } from '../services/live-price-focus.service';
import { ChartViewportFocusService } from '../services/chart-viewport-focus.service';
import {
  CHART_LUMINANCE_BOOST,
  PLOT_BOTTOM_DEFAULT,
  PLOT_BOTTOM_SEPARATED,
  resolveHistoricalCandleFade,
  VOLUME_OPACITY_FLOOR,
  VOLUME_SCALE_TOP_DEFAULT,
  VOLUME_SCALE_TOP_SEPARATED
} from '../utils/chart-atmosphere-recovery.util';
import { OverlayVisibilityService } from '../services/overlay-visibility.service';
import { ExecutionOverlayIntelligenceService, OverlayIntelContext } from '../services/execution-overlay-intelligence.service';
import { ChartFocusMode } from '../services/price-action-focus.engine';
import { IntensityMode } from '../services/situational-intensity.engine';
import { triggerDecayOpacity } from '../utils/information-decay.util';
import { ReplayUxSynthesisService } from '../services/chart/replay-viewport/replay-ux-synthesis.service';
import { ReplayViewportPlan, ReplayViewportState } from '../services/chart/replay-viewport/replay-viewport.models';
import { ReplayProfessionalReviewService } from '../services/replay-decision-visualization/replay-professional-review.service';
import { ReplayStudyMode, ReplayNarrativeBand, signalToTradingSignal } from '../services/replay-decision-visualization/replay-decision-visualization.models';
import { ReplayMultiDayContextEngine } from '../services/replay-decision-visualization/replay-multi-day-context.engine';

@Component({
  selector: 'app-trading-chart',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './trading-chart.component.html',
  styleUrl: './trading-chart.component.scss'
})
export class TradingChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('chartZone', { static: true }) chartZone!: ElementRef<HTMLDivElement>;
  @ViewChild('zoneCanvas', { static: true }) zoneCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tooltip', { static: true }) tooltipEl!: ElementRef<HTMLDivElement>;
  @ViewChild('crosshairInfo', { static: true }) crosshairInfoEl!: ElementRef<HTMLDivElement>;

  @Input() candles: Candle[] = [];
  @Input() signals: TradingSignal[] = [];
  @Input() indicators: IndicatorSnapshot | null = null;
  @Input() symbol = 'NVDA';
  @Input() livePrice: number | null = null;
  @Input() trendLabel = '—';
  @Input() trendShade: TrendShade = 'neutral';
  @Input() loading = false;
  @Input() replayMode = false;
  @Input() replayEvents: ReplaySignalEvent[] = [];
  @Input() selectedReplayEvent: ReplaySignalEvent | null = null;
  @Input() executionLevels: ChartExecutionLevel[] = [];
  @Input() anchorState: ChartAnchorState = 'LIVE_LOCKED';
  @Input() emphasizeLiveCandle = false;
  @Input() tradeRrLabel: string | null = null;
  @Input() sessionPrevClose: number | null = null;
  @Input() tradeOverlay: TradeStructureOverlay | null = null;
  @Input() liveCandlePulse = false;
  @Input() disableLivePulse = false;
  @Input() replaySimLabel: string | null = null;
  @Input() triggerLine: TriggerLine | null = null;
  @Input() cognitionPills: ChartCognitionPill[] = [];
  @Input() calmMode = false;
  @Input() focusPulse: FocusPulseMode = 'neutral';
  @Input() chartDominant = false;
  @Input() replayCandleIndex = -1;
  @Input() replayPlaying = false;
  @Input() replaySessionDate = '';
  @Input() replayReviewMode = false;
  @Input() replayMaskFuture = true;
  @Input() replayStudyMode: ReplayStudyMode = 'PLAYBACK';
  @Input() replaySessionStartIndex = 0;
  @Input() replayNarrativeBands: ReplayNarrativeBand[] = [];
  @Input() replayFocusBarIndex: number | null = null;
  @Input() viewportFocusEnabled = true;
  @Input() chartFocusMode: ChartFocusMode = 'TODAY';
  @Input() overlayIntel: OverlayIntelContext | null = null;
  @Input() urgencyEscalation = false;
  @Input() intensityMode: IntensityMode = 'CALM';
  @Input() liveEnergy = 0.45;
  @Input() gridHorzOpacity = 0.28;
  @Input() gridVertOpacity = 0.2;
  @Input() tensionScore = 0;
  @Input() chartContrast = 1;
  @Input() failurePressure = false;
  @Input() labelSharpness = 0.7;
  @Input() volumePulse = 0.22;
  @Input() maDepth = 0.42;
  @Input() historyFade = 0.38;
  @Input() candleEmphasis = 0.5;
  @Input() chartTightness = 1;
  @Input() failureBias = 0;
  @Input() volumeContrast = 0.2;
  @Input() staleTrigger = false;
  @Input() corridorBias: 'target' | 'stop' | 'neutral' = 'neutral';
  @Input() corridorStrength = 0.5;
  @Input() labelGravity: Record<string, number> | null = null;
  @Input() depthLayers: { liveCandle: number; overlays: number; labels: number; movingAverages: number; history: number; grid: number } | null = null;
  @Input() silenceActive = false;
  @Input() triggerSoftness = 1;
  @Input() gridDepth = 0.72;
  @Input() forwardPressure = 0;
  @Input() pressureBrightness = 1;
  @Input() temporalTriggerOpacity = 1;
  @Input() stillnessActive = true;
  @Input() volumeLiquidity = 0.28;
  @Input() executionRailActive = false;
  @Input() railSeparated = false;

  @Output() replayEventClick = new EventEmitter<ReplaySignalEvent>();
  @Output() followLatestChange = new EventEmitter<boolean>();
  @Output() replayHeadJump = new EventEmitter<void>();

  axisBandTicks: { label: string; pct: number }[] = [];
  replayViewportState: ReplayViewportState | null = null;
  replayMinimap: { headPct: number; viewportFromPct: number; viewportToPct: number } | null = null;

  private liveStateSub?: Subscription;

  private chart?: IChartApi;
  private candleSeries?: ISeriesApi<'Candlestick'>;
  private volumeSeries?: ISeriesApi<'Histogram'>;
  private ema9Series?: ISeriesApi<'Line'>;
  private ema20Series?: ISeriesApi<'Line'>;
  private ema50Series?: ISeriesApi<'Line'>;
  private vwapSeries?: ISeriesApi<'Line'>;
  private resizeObserver?: ResizeObserver;
  private followLatest = true;
  private firstFitDone = false;
  private signalByTime = new Map<number, TradingSignal>();
  private priceLines: IPriceLine[] = [];
  private overlayRaf = 0;
  private cachedOverlayKey = '';
  private labelLayouts: LabelLayout[] = [];
  private resolvedAxisLabels: ResolvedAxisLabel[] = [];
  stackedPills: StackLayoutItem[] = [];
  cognitionGapPx = 14;
  cognitionSafeZone: CognitionSafeZoneSnapshot = {
    exclusionCorridorPx: 32,
    columnRightPx: 96,
    chartRightInsetPx: 0,
    priceScaleMinWidthPx: 64
  };
  private hoveredLabel: string | null = null;
  private zoomedOut = false;
  private scaleDensitySnap: ScaleDensitySnapshot = {
    sparse: false, layoutFontSize: 11, entireTextOnly: false, marginExpand: 0, alignLabels: true
  };
  private atmosphereClampPx = 42;
  private viewportUpdateProgrammatic = false;
  private lastRenderedCandleCount = 0;
  private markerCacheKey = '';
  private markerCache: SeriesMarker<Time>[] = [];
  private replayViewportInitialized = false;
  private replayViewportSub?: Subscription;

  constructor(
    private chartLiveState: ChartLiveStateService,
    private labelCollision: LabelCollisionService,
    private axisLabelResolution: AxisLabelResolutionService,
    private overlayStack: OverlayStackLayoutEngine,
    private cognitionBreathing: CognitionBreathingEngine,
    private cognitionSafeZoneService: CognitionSafeZoneService,
    private scaleDensity: AdaptiveScaleDensityService,
    private footerAtmosphere: FooterAtmosphereClampService,
    private viewportFocus: ChartViewportFocusService,
    private overlayVisibility: OverlayVisibilityService,
    private overlayIntelService: ExecutionOverlayIntelligenceService,
    private annotationLane: ExecutionAnnotationLaneService,
    private replayViewportUx: ReplayUxSynthesisService,
    private replayReview: ReplayProfessionalReviewService,
    private multiDayContext: ReplayMultiDayContextEngine,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    // Wait for flex/grid layout so the container has non-zero height before createChart
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initChart();
        this.updateChart();
        if (this.replayMode) this.applyReplayTimeAxisLayout();
        this.liveStateSub = this.chartLiveState.returnToLiveRequested$.subscribe(() => {
          this.followLatest = true;
          this.chart?.timeScale().scrollToRealTime();
        });
        this.replayViewportSub = this.replayViewportUx.state$.subscribe(state => {
          this.replayViewportState = state;
          this.replayMinimap = this.replayMode
            ? this.replayViewportUx.minimapSnapshot(this.candles.length)
            : null;
          this.cdr.markForCheck();
        });
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['symbol'] && !changes['symbol'].firstChange)
        || (changes['replaySessionDate'] && !changes['replaySessionDate'].firstChange)) {
      this.firstFitDone = false;
      this.followLatest = true;
      this.resetReplayChartViewport();
    }
    if (changes['anchorState'] && this.anchorState === 'LIVE_LOCKED') {
      this.followLatest = true;
    }
    if (changes['replayFocusBarIndex'] && this.chart) {
      this.scheduleOverlayDraw();
    }
    if (this.chart && (changes['candles'] || changes['signals'] || changes['symbol']
        || changes['replayEvents'] || changes['replayMode'] || changes['executionLevels']
        || changes['tradeOverlay'] || changes['emphasizeLiveCandle'] || changes['sessionPrevClose']
        || changes['liveCandlePulse'] || changes['disableLivePulse'] || changes['triggerLine']
        || changes['focusPulse'] || changes['chartDominant'] || changes['chartFocusMode']
        || changes['overlayIntel'] || changes['urgencyEscalation'] || changes['intensityMode']
        || changes['liveEnergy'] || changes['gridHorzOpacity'] || changes['tensionScore']
        || changes['maDepth'] || changes['historyFade'] || changes['candleEmphasis']
        || changes['depthLayers'] || changes['gridDepth'] || changes['cognitionPills']
        || changes['railSeparated'] || changes['executionRailActive']
        || changes['replayCandleIndex'] || changes['replayPlaying'] || changes['replayReviewMode']
        || changes['replayStudyMode'] || changes['replayNarrativeBands'])) {
      this.updateChart();
    }
    if (changes['replayMode'] && this.chart) {
      this.applyReplayTimeAxisLayout();
    }
    if (changes['railSeparated'] || changes['executionRailActive']) {
      this.applyRailSeparation();
      this.scheduleChartResize();
    }
    if (changes['cognitionPills'] || changes['intensityMode'] || changes['tensionScore']
        || changes['urgencyEscalation'] || changes['silenceActive']) {
      this.refreshStackedPills();
    }
    if (changes['executionRailActive'] && this.chart) {
      this.applyAtmosphereClamp();
      this.applyPriceScaleSafeZone();
      this.applyTimestampLayer();
    }
    if (changes['intensityMode'] && this.chart) {
      this.applyAdaptiveScaleDensity();
    }
    if (changes['chartDominant'] && this.chart) {
      this.applyDominanceGrid();
    }
    if (changes['gridHorzOpacity'] || changes['gridVertOpacity'] || changes['gridDepth'] || changes['depthLayers']) {
      this.applyDominanceGrid();
    }
    if (this.chart && (changes['tradeOverlay'] || changes['candles'] || changes['executionLevels']
        || changes['liveCandlePulse'] || changes['triggerLine'] || changes['calmMode']
        || changes['focusPulse'] || changes['overlayIntel'] || changes['urgencyEscalation']
        || changes['corridorBias'] || changes['corridorStrength'] || changes['silenceActive']
        || changes['failurePressure'] || changes['failureBias'] || changes['triggerSoftness'])) {
      this.scheduleOverlayDraw();
    }
  }

  ngOnDestroy(): void {
    this.liveStateSub?.unsubscribe();
    this.replayViewportSub?.unsubscribe();
    if (this.overlayRaf) cancelAnimationFrame(this.overlayRaf);
    this.resizeObserver?.disconnect();
    this.chart?.remove();
  }

  private refreshStackedPills(): void {
    const pillCount = this.cognitionPills.length;
    const breath = this.cognitionBreathing.resolve({
      pillCount,
      intensityMode: this.intensityMode,
      urgency: this.urgencyEscalation,
      tensionScore: this.tensionScore,
      zoomedOut: this.zoomedOut,
      silenceActive: this.silenceActive
    });
    this.cognitionGapPx = breath.gapPx;
    this.cognitionSafeZone = this.cognitionSafeZoneService.resolve({ pillCount });
    this.applyPriceScaleSafeZone();
    const laid = this.overlayStack.layout(
      this.cognitionPills.map(p => ({
        id: p.label,
        label: p.label,
        priority: this.overlayStack.pillPriority(p.label),
        tone: p.tone
      })),
      breath.maxVisible
    );
    this.stackedPills = laid.map((item, index) => ({
      ...item,
      opacity: index > 0
        ? item.opacity * breath.inactiveMultiplier
        : item.opacity
    }));
  }

  private applyAdaptiveScaleDensity(): void {
    if (!this.chart) return;
    this.scaleDensitySnap = this.scaleDensity.resolve({
      intensityMode: this.intensityMode,
      executionLevelPrices: this.executionLevels.map(l => l.price)
    });
    this.chart.applyOptions({
      layout: { fontSize: this.scaleDensitySnap.layoutFontSize }
    });
    this.chart.priceScale('right').applyOptions({
      entireTextOnly: this.scaleDensitySnap.entireTextOnly,
      alignLabels: this.scaleDensitySnap.alignLabels
    });
  }

  private applyAtmosphereClamp(): void {
    const wrap = this.chartContainer?.nativeElement?.parentElement;
    const h = wrap?.clientHeight ?? 380;
    const clamp = this.footerAtmosphere.resolve({ chartHeightPx: h, railActive: this.executionRailActive });
    this.atmosphereClampPx = clamp.atmosphereMaxPx;
  }

  private applyTimestampLayer(): void {
    if (!this.chart) return;
    const scaleOpacity = this.railSeparated ? 0.78 : 0.82;
    const fontSize = this.railSeparated ? 12 : 13;
    this.chart.applyOptions({
      layout: {
        fontSize,
        textColor: `rgba(194, 202, 211, ${scaleOpacity})`
      }
    });
    this.chart.timeScale().applyOptions({
      borderColor: this.executionRailActive ? 'rgba(42, 46, 57, 0.32)' : '#2a2e39'
    });
  }

  private volumeRailFadeMultiplier(barIndex: number, total: number): number {
    if (this.railSeparated || !this.executionRailActive || total < 2) return 1;
    const distFromLive = total - 1 - barIndex;
    const fadeBand = Math.min(14, Math.round(this.atmosphereClampPx / 3));
    if (distFromLive > fadeBand) return 1;
    const t = (fadeBand - distFromLive) / fadeBand;
    return Math.max(VOLUME_OPACITY_FLOOR, 1 - t * 0.38);
  }

  chartSurfaceFilter(): string {
    const brightness = Math.min(1.12, this.pressureBrightness * CHART_LUMINANCE_BOOST);
    return `contrast(${this.chartContrast}) brightness(${brightness})`;
  }

  private applyPriceScaleSafeZone(plan?: { top?: number; bottom?: number }): void {
    if (!this.chart) return;
    const zone = this.cognitionSafeZone;
    const pillCount = this.stackedPills.length || this.cognitionPills.length;
    const railBottom = this.railSeparated ? PLOT_BOTTOM_SEPARATED : (this.executionRailActive ? 0.12 : PLOT_BOTTOM_DEFAULT);
    const expand = this.scaleDensitySnap.marginExpand;
    const bottom = plan?.bottom != null
      ? Math.max(railBottom, Math.min(0.22, plan.bottom * (2 - this.chartTightness) + expand))
      : railBottom + expand;
    const pillTop = pillCount > 2 ? 0.05 : pillCount > 0 ? 0.028 : 0;
    const topBase = plan?.top != null
      ? Math.min(0.16, plan.top * (2 - this.chartTightness) * 0.82)
      : 0.028;
    const top = Math.min(0.18, topBase + pillTop + zone.chartRightInsetPx * 0.0025 + expand * 0.75);
    this.chart.priceScale('right').applyOptions({
      minimumWidth: zone.priceScaleMinWidthPx,
      entireTextOnly: this.scaleDensitySnap.entireTextOnly,
      alignLabels: this.scaleDensitySnap.alignLabels,
      scaleMargins: { top, bottom }
    });
    this.chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: this.railSeparated ? PLOT_BOTTOM_SEPARATED : (this.executionRailActive ? 0.12 : PLOT_BOTTOM_DEFAULT)
      }
    });
  }

  private resolveAxisLabels(h: number): void {
    if (!this.candleSeries) {
      this.resolvedAxisLabels = [];
      return;
    }
    this.resolvedAxisLabels = this.axisLabelResolution.resolve(
      this.labelLayouts,
      (price) => this.candleSeries!.priceToCoordinate(price),
      {
        failureMode: this.intensityMode === 'FAILURE',
        minGapPx: this.overlayStack.minGapPx,
        chartHeight: h,
        topExclusionPx: this.cognitionSafeZone.exclusionCorridorPx
          + (this.stackedPills.length > 2 ? 28 : this.stackedPills.length > 0 ? 16 : 0)
      }
    );
  }

  private initChart(): void {
    const el = this.chartContainer.nativeElement;
    const bounds = this.chartBoundsElement();
    const size = this.measureChartSize(el, bounds);

    this.chart = createChart(el, {
      width: size.width,
      height: size.height,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: 'rgba(194, 202, 211, 0.82)',
        fontSize: 13,
        attributionLogo: false
      },
      grid: {
        vertLines: { color: 'rgba(24, 28, 36, 0.2)' },
        horzLines: { color: 'rgba(24, 28, 36, 0.28)' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#758696', width: 1, style: 2, labelBackgroundColor: '#2a2e39' },
        horzLine: { color: '#758696', width: 1, style: 2, labelBackgroundColor: '#2a2e39' }
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.04, bottom: 0.22 },
        minimumWidth: 64
      },
      timeScale: {
        borderColor: '#2a2e39',
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: 8,
        minBarSpacing: 4,
        fixLeftEdge: false,
        fixRightEdge: false,
        tickMarkFormatter: (time: Time) => this.formatEtAxisTime(time)
      },
      localization: {
        timeFormatter: (time: Time) => this.formatEtTime(time),
        dateFormat: 'MMM dd'
      }
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350'
    });

    this.volumeSeries = this.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    });
    this.chart.priceScale('volume').applyOptions({
      scaleMargins: { top: VOLUME_SCALE_TOP_DEFAULT, bottom: PLOT_BOTTOM_DEFAULT }
    });

    this.ema9Series = this.chart.addLineSeries({
      color: '#b89a28', lineWidth: 1, title: '', lastValueVisible: false, priceLineVisible: false
    });
    this.ema20Series = this.chart.addLineSeries({
      color: '#356fa0', lineWidth: 1, title: '', lastValueVisible: false, priceLineVisible: false
    });
    this.ema50Series = this.chart.addLineSeries({
      color: '#7d5f88', lineWidth: 1, title: '', lastValueVisible: false, priceLineVisible: false
    });
    this.vwapSeries = this.chart.addLineSeries({
      color: '#a87424', lineWidth: 1, title: '', lastValueVisible: false, priceLineVisible: false
    });

    this.chart.subscribeCrosshairMove(param => this.onCrosshairMove(param));
    this.chart.subscribeClick(param => this.onChartClick(param));
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const range = this.chart?.timeScale().getVisibleLogicalRange();
      if (!range || !this.candles.length) {
        return;
      }
      if (this.replayMode) {
        if (this.viewportUpdateProgrammatic) {
          this.updateAxisBandTicks();
          this.scheduleOverlayDraw();
          return;
        }
        this.replayViewportUx.onUserViewportChange({
          visibleRange: { from: range.from, to: range.to },
          replayIndex: this.replayCandleIndex,
          candleCount: this.candles.length,
          playing: this.replayPlaying
        });
        this.followLatest = false;
        this.followLatestChange.emit(false);
        this.updateAxisBandTicks();
        this.scheduleOverlayDraw();
        return;
      }
      this.followLatest = range.to >= this.candles.length - 2;
      this.followLatestChange.emit(this.followLatest);
      this.chartLiveState.syncFromChart('LIVE', this.followLatest);
      this.updateAxisBandTicks();
      this.scheduleOverlayDraw();
    });

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.chart) {
        return;
      }
      const next = this.measureChartSize(el, this.chartBoundsElement());
      if (next.width > 0 && next.height > 0) {
        this.chart.applyOptions({ width: next.width, height: next.height });
        this.updateAxisBandTicks();
        this.scheduleOverlayDraw();
      }
    });
    const boundsEl = this.chartBoundsElement();
    if (boundsEl) {
      this.resizeObserver.observe(boundsEl);
    }
    this.resizeObserver.observe(el);
    this.bindLabelHover();
    this.applyDominanceGrid();
    this.applyAdaptiveScaleDensity();
    this.applyAtmosphereClamp();
    this.applyTimestampLayer();
    this.applyRailSeparation();
    this.scheduleChartResize();
    this.refreshStackedPills();
  }

  private chartBoundsElement(): HTMLElement | null {
    return this.chartZone?.nativeElement ?? this.chartContainer?.nativeElement?.parentElement ?? null;
  }

  private scheduleChartResize(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.chart || !this.chartContainer) return;
        const el = this.chartContainer.nativeElement;
        const next = this.measureChartSize(el, this.chartBoundsElement());
        if (next.width > 0 && next.height > 0) {
          this.chart.applyOptions({ width: next.width, height: next.height });
          this.updateAxisBandTicks();
          this.scheduleOverlayDraw();
        }
      });
    });
  }

  private applyRailSeparation(): void {
    if (!this.chart) return;
    const separated = this.railSeparated;
    // Keep native time axis visible inside chart-zone (directly under volume); rail sits below chart-zone.
    this.chart.applyOptions({
      timeScale: {
        visible: true,
        borderVisible: true,
        ticksVisible: true
      }
    });
    const plotBottom = separated ? PLOT_BOTTOM_SEPARATED : (this.executionRailActive ? 0.12 : PLOT_BOTTOM_DEFAULT);
    const volumeTop = separated ? VOLUME_SCALE_TOP_SEPARATED : VOLUME_SCALE_TOP_DEFAULT;
    this.chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.04,
        bottom: plotBottom
      }
    });
    this.chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: volumeTop,
        bottom: plotBottom
      }
    });
    this.applyTimestampLayer();
    this.updateAxisBandTicks();
  }

  private updateAxisBandTicks(): void {
    if (!this.railSeparated || !this.chart || !this.candles.length) {
      this.axisBandTicks = [];
      return;
    }
    const w = this.chartContainer?.nativeElement?.clientWidth ?? 0;
    if (w <= 0) return;
    const range = this.chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const from = Math.max(0, Math.floor(range.from));
    const to = Math.min(this.candles.length - 1, Math.ceil(range.to));
    if (to <= from) return;
    const slots = Math.min(8, Math.max(4, Math.floor(w / 96)));
    const ticks: { label: string; pct: number }[] = [];
    for (let i = 0; i < slots; i++) {
      const idx = from + Math.round((i / Math.max(1, slots - 1)) * (to - from));
      const c = this.candles[idx];
      if (!c) continue;
      const t = this.toChartTime(c.time);
      const x = this.chart.timeScale().timeToCoordinate(t);
      if (x == null) continue;
      ticks.push({ label: this.formatEtAxisTime(t), pct: Math.max(2, Math.min(98, (x / w) * 100)) });
    }
    this.axisBandTicks = ticks;
    this.cdr.markForCheck();
  }

  private applyDominanceGrid(): void {
    if (!this.chart) return;
    const gridMul = this.depthLayers?.grid ?? this.gridDepth;
    const h = this.gridHorzOpacity * gridMul;
    const v = this.gridVertOpacity * gridMul;
    const soft = this.chartDominant;
    this.chart.applyOptions({
      grid: {
        vertLines: { color: `rgba(24, 28, 36, ${v})` },
        horzLines: { color: `rgba(24, 28, 36, ${h})` }
      },
      rightPriceScale: { borderColor: soft ? 'rgba(30, 34, 42, 0.5)' : 'rgba(35, 39, 48, 0.6)' },
      timeScale: { borderColor: soft ? 'rgba(30, 34, 42, 0.5)' : 'rgba(35, 39, 48, 0.6)' }
    });
    this.ema9Series?.applyOptions({ color: soft ? '#a89024' : '#b89a28', lineWidth: 1 });
    this.ema20Series?.applyOptions({ color: soft ? '#2f6290' : '#356fa0', lineWidth: 1 });
    this.ema50Series?.applyOptions({ color: soft ? '#705578' : '#7d5f88', lineWidth: 1 });
    this.vwapSeries?.applyOptions({ color: soft ? '#966820' : '#a87424', lineWidth: 1 });
  }

  private bindLabelHover(): void {
    const canvas = this.zoneCanvas?.nativeElement;
    if (!canvas) return;
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      let hit: string | null = null;
      for (const item of this.labelLayouts) {
        const ly = this.candleSeries?.priceToCoordinate(item.price);
        if (ly == null) continue;
        if (Math.abs(y - ly - item.offsetPx) < 10) {
          hit = item.shortLabel;
          break;
        }
      }
      if (hit !== this.hoveredLabel) {
        this.hoveredLabel = hit;
        this.scheduleOverlayDraw();
      }
    }, { passive: true });
    canvas.addEventListener('mouseleave', () => {
      if (this.hoveredLabel) {
        this.hoveredLabel = null;
        this.scheduleOverlayDraw();
      }
    }, { passive: true });
  }

  private measureChartSize(el: HTMLElement, bounds: HTMLElement | null): { width: number; height: number } {
    const width = el.clientWidth || bounds?.clientWidth || 0;
    const height = bounds?.clientHeight ?? el.clientHeight ?? 0;
    return {
      width: Math.max(width, 100),
      height: height > 0 ? height : 240
    };
  }

  private updateChart(): void {
    if (!this.candleSeries || !this.volumeSeries || !this.ema9Series || !this.ema20Series
        || !this.ema50Series || !this.vwapSeries) {
      return;
    }

    this.signalByTime.clear();
    const markerSource = this.replayMode && this.replayEvents.length
      ? this.replayEventsToSignals()
      : this.signals;
    for (const s of markerSource) {
      this.signalByTime.set(this.toChartTime(s.timestamp) as number, s);
    }

    const candleData: CandlestickData[] = this.candles.map((c, i) => {
      const isLive = !this.replayMode && i === this.candles.length - 1;
      const age = this.candles.length - 1 - i;
      const liveZone = !this.replayMode && age <= 15;
      const up = c.close >= c.open;
      const base: CandlestickData = {
        time: this.toChartTime(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      };
      if (this.replayMode && this.replaySessionStartIndex > 0 && i < this.replaySessionStartIndex) {
        const priorOpacity = this.multiDayContext.dimPriorDayOpacity(i, this.replaySessionStartIndex) * 0.85;
        return {
          ...base,
          color: up ? `rgba(38, 166, 154, ${0.35 * priorOpacity})` : `rgba(239, 83, 80, ${0.35 * priorOpacity})`,
          borderColor: up ? `rgba(38, 166, 154, ${0.3 * priorOpacity})` : `rgba(239, 83, 80, ${0.3 * priorOpacity})`,
          wickColor: up ? `rgba(38, 166, 154, ${0.28 * priorOpacity})` : `rgba(239, 83, 80, ${0.28 * priorOpacity})`
        };
      }
      if (this.replayMode && this.replayMaskFuture && !this.replayReviewMode
          && this.replayCandleIndex >= 0 && i > this.replayCandleIndex) {
        const ghost = this.replayStudyMode === 'TRAINING' ? 0.06 : 0.14;
        return {
          ...base,
          color: up ? `rgba(38, 166, 154, ${ghost})` : `rgba(239, 83, 80, ${ghost})`,
          borderColor: up ? `rgba(38, 166, 154, ${ghost * 0.8})` : `rgba(239, 83, 80, ${ghost * 0.8})`,
          wickColor: up ? `rgba(38, 166, 154, ${ghost * 0.7})` : `rgba(239, 83, 80, ${ghost * 0.7})`
        };
      }
      const histFade = this.depthLayers?.history ?? this.historyFade;
      const liveDom = Math.min(1, this.depthLayers?.liveCandle ?? this.candleEmphasis);
      const fade = resolveHistoricalCandleFade(age, histFade, liveDom);
      const energy = (this.liveEnergy + this.tensionScore * 0.001) * liveDom;
      const liveBoost = 1 + (this.tensionScore / 100) * 0.12;
      const pulse = (this.emphasizeLiveCandle || this.liveCandlePulse) && energy > 0.35;
      if (isLive && !this.loading && !this.replayMode) {
        const wickBloom = pulse ? (up ? `rgba(74, 222, 128, ${0.55 + energy * 0.35})` : `rgba(248, 113, 113, ${0.55 + energy * 0.35})`) : (up ? `rgba(38,166,154,${fade * 0.901})` : `rgba(239,83,80,${fade * 0.901})`);
        return {
          ...base,
          color: up
            ? (pulse ? `rgba(38, 166, 154, ${Math.min(1, 0.92 * liveBoost)})` : `rgba(38, 166, 154, ${fade})`)
            : (pulse ? `rgba(239, 83, 80, ${Math.min(1, 0.92 * liveBoost)})` : `rgba(239, 83, 80, ${fade})`),
          borderColor: pulse ? `rgba(230, 237, 243, ${0.55 + energy * 0.3})` : up ? '#26a69a' : '#ef5350',
          wickColor: wickBloom
        };
      }
      if (!liveZone && !this.replayMode) {
        const bodyAlpha = Math.max(0.42, 0.5 * fade);
        return {
          ...base,
          color: up ? `rgba(38, 166, 154, ${bodyAlpha})` : `rgba(239, 83, 80, ${bodyAlpha})`,
          borderColor: up ? `rgba(38, 166, 154, ${Math.max(0.445, 0.371 * fade)})` : `rgba(239, 83, 80, ${Math.max(0.445, 0.371 * fade)})`,
          wickColor: up ? `rgba(38, 166, 154, ${Math.max(0.445, 0.424 * fade)})` : `rgba(239, 83, 80, ${Math.max(0.445, 0.424 * fade)})`
        };
      }
      return base;
    });

    const volumeData: HistogramData[] = this.candles.map((c, i) => {
      const isLive = !this.replayMode && i === this.candles.length - 1;
      const liveZone = !this.replayMode && i >= this.candles.length - 15;
      const volPulse = isLive
        ? (this.volumePulse * this.candleEmphasis + this.tensionScore * 0.002) * (0.65 + this.volumeContrast) * this.volumeLiquidity
        : liveZone ? 0.22 * this.historyFade * this.volumeLiquidity : 0.14 * this.historyFade;
      let boost = liveZone ? volPulse : 0.22;
      boost *= this.volumeRailFadeMultiplier(i, this.candles.length);
      boost = Math.max(VOLUME_OPACITY_FLOOR, boost);
      return {
        time: this.toChartTime(c.time),
        value: c.volume,
        color: c.close >= c.open
          ? `rgba(45, 164, 152, ${Math.min(1, boost * 1.06)})`
          : `rgba(210, 88, 86, ${Math.min(1, boost * 1.04)})`
      };
    });

    this.candleSeries.setData(candleData);
    this.volumeSeries.setData(volumeData);
    this.ema9Series.setData(this.lineData(this.candles, c => c.ema9));
    this.ema20Series.setData(this.lineData(this.candles, c => c.ema20));
    this.ema50Series.setData(this.lineData(this.candles, c => c.ema50));
    this.vwapSeries.setData(this.lineData(this.candles, c => c.vwap));
    this.lastRenderedCandleCount = this.candles.length;
    this.applyChartDepth();
    this.candleSeries.setMarkers(this.buildMarkers());
    this.applyExecutionLevels();

    if (candleData.length === 0) {
      return;
    }

    if (this.replayMode) {
      this.syncReplayViewport();
    } else if (!this.firstFitDone) {
      this.applyViewportFocus(true);
      this.firstFitDone = true;
    } else if (this.viewportFocusEnabled && this.followLatest && this.anchorState !== 'HISTORY_REVIEW') {
      this.applyViewportFocus(false);
    } else if (this.followLatest && this.anchorState !== 'HISTORY_REVIEW') {
      this.chart?.timeScale().scrollToRealTime();
    }
    this.scheduleOverlayDraw();
    this.refreshStackedPills();
    this.updateAxisBandTicks();
  }

  private applyChartDepth(): void {
    const d = this.depthLayers?.movingAverages ?? this.maDepth;
    this.ema9Series?.applyOptions({ color: `rgba(184, 154, 40, ${d * 0.85})`, lineWidth: 1 });
    this.ema20Series?.applyOptions({ color: `rgba(53, 111, 160, ${d * 0.9})`, lineWidth: 1 });
    this.ema50Series?.applyOptions({ color: `rgba(125, 95, 136, ${d * 0.75})`, lineWidth: 1 });
    this.vwapSeries?.applyOptions({ color: `rgba(168, 116, 36, ${d * 0.8})`, lineWidth: 1 });
  }

  private applyViewportFocus(initial: boolean): void {
    if (!this.chart || !this.candleSeries || !this.candles.length) return;
    if (this.replayMode && this.replayViewportUx.shouldBlockLiveViewport()) {
      return;
    }

    const entry = this.executionLevels.find(l => l.label === 'Entry');
    const stop = this.executionLevels.find(l => l.label === 'Stop');
    const target = this.executionLevels.find(l => l.label === 'Target');

    const plan = this.viewportFocus.resolve({
      candleCount: this.candles.length,
      replayMode: this.replayMode,
      replayIndex: this.replayCandleIndex,
      focusMode: this.chartFocusMode,
      hasActiveSetup: !!this.tradeOverlay?.active || this.executionLevels.length > 0,
      entryPrice: entry?.price ?? null,
      stopPrice: stop?.price ?? null,
      targetPrice: target?.price ?? null,
      triggerPrice: this.triggerLine?.price ?? null,
      livePrice: this.livePrice,
      candleHighs: this.candles.map(c => c.high),
      candleLows: this.candles.map(c => c.low)
    });

    const wasZoomedOut = this.zoomedOut;
    this.zoomedOut = this.overlayVisibility.isZoomedOut(plan.visibleTo - plan.visibleFrom);
    if (wasZoomedOut !== this.zoomedOut) {
      this.refreshStackedPills();
    }
    this.chart.timeScale().applyOptions({ rightOffset: plan.rightOffset ?? 2 });
    this.chart.timeScale().setVisibleLogicalRange({ from: plan.visibleFrom, to: plan.visibleTo });
    this.applyPriceScaleSafeZone(plan.scaleMargins);

    if (plan.priceMin != null && plan.priceMax != null) {
      this.candleSeries.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: plan.priceMin!, maxValue: plan.priceMax! }
        })
      });
    } else if (initial && !this.replayMode) {
      this.candleSeries.applyOptions({ autoscaleInfoProvider: undefined });
      this.chart.timeScale().fitContent();
    }
  }

  private syncReplayViewport(): void {
    if (!this.chart || !this.candleSeries || !this.candles.length) return;

    const isInitial = !this.replayViewportInitialized;
    const decision = this.replayViewportUx.onReplayTick({
      replayIndex: this.replayCandleIndex,
      candleCount: this.candles.length,
      playing: this.replayPlaying,
      symbol: this.symbol,
      sessionDate: this.replaySessionDate,
      candleHighs: this.candles.map(c => c.high),
      candleLows: this.candles.map(c => c.low),
      isInitial
    });

    if (decision.shouldSyncViewport && decision.plan) {
      this.applyReplayViewport(decision.plan, decision.animate);
    }
    if (isInitial) {
      this.replayViewportInitialized = true;
    }
  }

  applyReplayViewport(plan: ReplayViewportPlan, animate = false): void {
    if (!this.chart || !this.candleSeries) return;
    this.viewportUpdateProgrammatic = true;
    this.chart.timeScale().applyOptions({ rightOffset: plan.rightOffset ?? 2 });
    this.chart.timeScale().setVisibleLogicalRange({ from: plan.visibleFrom, to: plan.visibleTo });
    this.applyPriceScaleSafeZone(plan.scaleMargins);
    if (plan.priceMin != null && plan.priceMax != null) {
      this.candleSeries.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: plan.priceMin!, maxValue: plan.priceMax! }
        })
      });
    }
    if (animate) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.viewportUpdateProgrammatic = false;
        });
      });
    } else {
      requestAnimationFrame(() => {
        this.viewportUpdateProgrammatic = false;
      });
    }
  }

  resetReplayChartViewport(): void {
    this.replayViewportInitialized = false;
    this.candleSeries?.applyOptions({ autoscaleInfoProvider: undefined });
  }

  focusReplayHead(): void {
    if (!this.replayMode || this.replayCandleIndex < 0 || !this.candles.length) return;
    const plan = this.replayViewportUx.onJumpToHead(
      this.replayCandleIndex,
      this.candles.length,
      this.candles.map(c => c.high),
      this.candles.map(c => c.low)
    );
    this.applyReplayViewport(plan, true);
    this.replayHeadJump.emit();
  }

  snapReplayViewport(barIndex: number): void {
    if (!this.replayMode || barIndex < 0 || !this.candles.length) return;
    const plan = this.replayViewportUx.onSnapToBar(
      barIndex,
      this.candles.length,
      this.candles.map(c => c.high),
      this.candles.map(c => c.low)
    );
    this.applyReplayViewport(plan, true);
  }

  private applyReplayTimeAxisLayout(): void {
    if (!this.chart) return;
    const w = this.chartContainer?.nativeElement?.clientWidth ?? 800;
    const layout = this.replayReview.timeAxisEngine.resolve(w, this.replayMode);
    this.chart.applyOptions({
      layout: { fontSize: layout.fontSize, attributionLogo: false },
      timeScale: layout.timeScale
    });
    this.chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.04, bottom: layout.priceScaleBottom }
    });
    this.chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.78, bottom: layout.volumeScaleBottom }
    });
  }

  private drawNarrativeBands(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.chart || !this.candles.length) return;
    for (const band of this.replayNarrativeBands) {
      const fromC = this.candles[Math.min(band.fromBar, this.candles.length - 1)];
      const toC = this.candles[Math.min(band.toBar, this.candles.length - 1)];
      if (!fromC || !toC) continue;
      const x1 = this.chart.timeScale().timeToCoordinate(this.toChartTime(fromC.time));
      const x2 = this.chart.timeScale().timeToCoordinate(this.toChartTime(toC.time));
      if (x1 == null || x2 == null) continue;
      ctx.save();
      ctx.fillStyle = band.color;
      ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), h);
      ctx.fillStyle = 'rgba(194, 202, 211, 0.45)';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillText(band.label, Math.min(x1, x2) + 4, 12);
      ctx.restore();
    }
  }

  private onReplaySignalInspect(): void {
    this.replayViewportUx.onSignalInspection();
  }

  private scheduleOverlayDraw(): void {
    if (this.overlayRaf) cancelAnimationFrame(this.overlayRaf);
    const loop = () => {
      this.drawZoneOverlay();
      if (this.needsAnimatedOverlay()) {
        this.overlayRaf = requestAnimationFrame(loop);
      }
    };
    this.overlayRaf = requestAnimationFrame(loop);
  }

  private needsAnimatedOverlay(): boolean {
    if (this.stillnessActive) return false;
    const escalate = this.urgencyEscalation || !this.calmMode;
    return (!!this.liveCandlePulse && !this.disableLivePulse)
      || (!!this.triggerLine && !this.triggerLine.active && escalate && this.tensionScore > 25)
      || (this.focusPulse !== 'neutral' && !this.replayMode && escalate)
      || (!!(this.overlayIntel?.exitNow) && escalate);
  }

  private drawZoneOverlay(): void {
    const canvas = this.zoneCanvas?.nativeElement;
    const container = this.chartContainer?.nativeElement;
    if (!canvas || !container || !this.chart || !this.candleSeries) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const key = `${w}x${h}-${this.tradeOverlay?.entryLow}-${this.tradeOverlay?.targetZone}-${this.candles.length}`;
    this.cachedOverlayKey = key;

    this.drawSessionShading(ctx, w, h);
    if (this.replayMode && this.replayNarrativeBands.length) {
      this.drawNarrativeBands(ctx, w, h);
    }
    this.drawConvictionPressure(ctx, w, h);
    if (this.tradeOverlay?.active) {
      this.drawExecutionCorridor(ctx, w, h);
    }
    if (this.failurePressure) {
      this.drawFailurePressure(ctx, w, h);
    }
    if (this.liveCandlePulse && !this.disableLivePulse && !this.stillnessActive && this.candles.length) {
      this.drawLiveRipple(ctx, w, h);
    }
    this.resolveAxisLabels(h);
    if (this.triggerLine) {
      this.drawTriggerLine(ctx, w, h);
    }
    this.drawStackedLabels(ctx, w, h);
    if (this.replayMode && this.replayCandleIndex >= 0) {
      this.drawReplayHeadMarker(ctx, w, h);
    }
    if (this.replayMode && this.replayFocusBarIndex != null && this.replayFocusBarIndex >= 0) {
      this.drawReplayFocusBeam(ctx, w, h, this.replayFocusBarIndex);
    }
  }

  private drawReplayFocusBeam(ctx: CanvasRenderingContext2D, w: number, h: number, barIndex: number): void {
    if (!this.chart || barIndex < 0 || barIndex >= this.candles.length) return;
    const candle = this.candles[barIndex];
    const x = this.chart.timeScale().timeToCoordinate(this.toChartTime(candle.time));
    if (x == null) return;
    const pulse = 0.55 + Math.sin(Date.now() / 180) * 0.25;
    ctx.save();
    const grad = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
    grad.addColorStop(0, 'rgba(88, 166, 255, 0)');
    grad.addColorStop(0.5, `rgba(88, 166, 255, ${0.35 * pulse})`);
    grad.addColorStop(1, 'rgba(88, 166, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(Math.max(0, x - 24), 0, 48, h);
    ctx.strokeStyle = `rgba(121, 192, 255, ${0.85 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillStyle = `rgba(121, 192, 255, ${0.95})`;
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◆ SIGNAL', x, h - 8);
    ctx.restore();
  }

  private drawReplayHeadMarker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.chart || this.replayCandleIndex < 0 || this.replayCandleIndex >= this.candles.length) return;
    const candle = this.candles[this.replayCandleIndex];
    const x = this.chart.timeScale().timeToCoordinate(this.toChartTime(candle.time));
    if (x == null) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(210, 170, 90, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(210, 170, 90, 0.92)';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▶ HEAD', x, 14);
    ctx.restore();
  }

  private drawTriggerLine(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.triggerLine || !this.candleSeries) return;
    const y = this.candleSeries.priceToCoordinate(this.triggerLine.price);
    if (y == null) return;
    const nearTrigger = !!this.triggerLine && !this.triggerLine.active;
    const decay = triggerDecayOpacity(this.staleTrigger, nearTrigger) * this.temporalTriggerOpacity;
    const pulse = this.calmMode && !this.urgencyEscalation ? 0 : (Date.now() % 3200) / 3200;
    const clarity = (0.28 + (this.tensionScore / 100) * 0.35 * this.labelSharpness) * decay * this.triggerSoftness;
    const glow = this.triggerLine.active ? 0.75 * decay : clarity + pulse * 0.12;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = this.triggerLine.kind === 'FAIL'
      ? `rgba(248, 81, 73, ${glow})`
      : `rgba(210, 170, 90, ${glow})`;
    ctx.lineWidth = this.triggerLine.active ? 1.5 : 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w - 68, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = this.triggerLine.active ? '#d2aa5a' : `rgba(196, 176, 130, ${0.58 + pulse * 0.12})`;
    ctx.textAlign = 'right';
    const short = this.triggerLine.label.length > 22
      ? this.triggerLine.label.slice(0, 20) + '…'
      : this.triggerLine.label;
    const occupied = this.resolvedAxisLabels.filter(x => x.visible).map(x => x.resolvedY);
    const placement = this.annotationLane.placeCanvasLabel(y, 'breakout', occupied);
    if (!placement.visible) {
      ctx.restore();
      return;
    }
    ctx.globalAlpha = placement.opacity;
    ctx.fillText(short, w - 6, placement.y);
    ctx.restore();
  }

  private drawStackedLabels(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.candleSeries || !this.resolvedAxisLabels.length) return;
    const axisGutter = 68;
    const labelOffsetFromAxis = 96;
    const lineEnd = w - axisGutter - labelOffsetFromAxis;
    const lineStart = Math.max(72, lineEnd - 88);
    ctx.save();
    ctx.textAlign = 'left';
    for (const item of this.resolvedAxisLabels) {
      if (!item.visible) continue;
      if (item.opacity < 0.42 && this.hoveredLabel !== item.shortLabel) continue;
      const hovered = this.hoveredLabel === item.shortLabel;
      const alpha = Math.max(0.42, hovered ? 0.92 : item.opacity * this.labelSharpness * (this.depthLayers?.labels ?? 1) * 0.72);
      ctx.globalAlpha = alpha;
      ctx.font = hovered ? '650 12px system-ui, sans-serif' : '600 11px system-ui, sans-serif';
      const lineColor = 'rgba(184, 194, 204, 0.38)';
      const textColor = hovered ? 'rgba(242, 245, 247, 0.92)' : 'rgba(201, 209, 217, 0.72)';
      const y = item.resolvedY;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineStart, y);
      ctx.lineTo(lineEnd, y);
      ctx.stroke();
      ctx.fillStyle = textColor;
      const text = hovered ? item.fullLabel : item.shortLabel;
      ctx.fillText(text.toUpperCase(), lineStart + 2, y - 3);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawLiveRipple(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.candles.length || !this.chart) return;
    const last = this.candles[this.candles.length - 1];
    const x = this.chart.timeScale().timeToCoordinate(this.toChartTime(last.time));
    const y = this.candleSeries?.priceToCoordinate(last.close);
    if (x == null) return;
    const pulse = (Date.now() % 2800) / 2800;
    const r = 6 + pulse * 12;
    const rgb = this.focusPulseColor();
    const amp = this.liveEnergy * (this.urgencyEscalation || !this.calmMode ? 1 : 0.45);
    ctx.strokeStyle = `rgba(${rgb}, ${0.18 * amp * (1 - pulse * 0.4)})`;
    ctx.lineWidth = this.focusPulse === 'active' || this.liveCandlePulse ? 1.5 : 1;
    const cy = y ?? h * 0.45;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(${rgb}, ${0.06 * amp * (1 - pulse)})`;
    ctx.beginPath();
    ctx.arc(x, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    if ((this.liveCandlePulse || this.focusPulse !== 'neutral') && amp > 0.6) {
      ctx.strokeStyle = `rgba(${rgb}, 0.35)`;
      ctx.beginPath();
      ctx.arc(x, cy, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private focusPulseColor(): string {
    switch (this.focusPulse) {
      case 'failure': return '248, 81, 73';
      case 'breakout': return '88, 166, 255';
      case 'active': return '63, 185, 80';
      default: return '255, 213, 79';
    }
  }

  private drawFailurePressure(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const stop = this.executionLevels.find(l => l.label === 'Stop');
    if (!stop || !this.candleSeries) return;
    const y = this.candleSeries.priceToCoordinate(stop.price);
    if (y == null) return;
    const bandH = Math.min(48, h * 0.12);
    const grad = ctx.createLinearGradient(0, y - bandH, 0, y + bandH * 0.5);
    grad.addColorStop(0, 'rgba(248, 81, 73, 0)');
    grad.addColorStop(0.55, `rgba(180, 120, 115, ${(0.025 + this.failureBias) * 0.58})`);
    grad.addColorStop(1, `rgba(180, 120, 115, ${(0.045 + this.failureBias) * 0.58})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - bandH, w - 68, bandH + bandH * 0.5);
  }

  private drawConvictionPressure(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (Math.abs(this.forwardPressure) < 0.05 || this.silenceActive) return;
    const amp = Math.min(0.08, Math.abs(this.forwardPressure) * 0.06) * 0.58;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.forwardPressure > 0) {
      grad.addColorStop(0, `rgba(38, 166, 154, ${amp * 0.4})`);
      grad.addColorStop(0.35, 'rgba(38, 166, 154, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.65, 'rgba(180, 120, 115, 0)');
      grad.addColorStop(1, `rgba(180, 120, 115, ${amp})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w - 68, h);
  }

  private drawExecutionCorridor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.tradeOverlay || !this.candleSeries) return;
    const entryMid = (this.tradeOverlay.entryLow + this.tradeOverlay.entryHigh) / 2;
    const entryY = this.candleSeries.priceToCoordinate(entryMid);
    const targetY = this.candleSeries.priceToCoordinate(this.tradeOverlay.targetZone);
    const stopY = this.candleSeries.priceToCoordinate(
      Math.min(this.tradeOverlay.stopZone, this.tradeOverlay.invalidation));
    if (entryY == null) return;

    const bandLeft = Math.max(0, w * (0.52 - (1 - this.corridorStrength) * 0.04));
    const bandRight = w - 72;
    const strength = Math.max(0.25, this.corridorStrength) * (this.silenceActive ? 0.52 : 1)
      * (this.depthLayers?.overlays ?? 0.5) * 0.62;

    const paintBand = (fromY: number, toY: number, up: boolean) => {
      const yTop = Math.min(fromY, toY);
      const yBot = Math.max(fromY, toY);
      if (yBot - yTop < 3) return;
      const grad = ctx.createLinearGradient(0, fromY, 0, toY);
      if (up) {
        grad.addColorStop(0, 'rgba(38, 166, 154, 0)');
        grad.addColorStop(0.4, `rgba(38, 166, 154, ${0.018 * strength})`);
        grad.addColorStop(1, `rgba(38, 166, 154, ${0.042 * strength})`);
      } else {
        grad.addColorStop(0, 'rgba(38, 166, 154, 0)');
        grad.addColorStop(0.55, `rgba(180, 120, 115, ${0.012 * strength})`);
        grad.addColorStop(1, `rgba(180, 120, 115, ${0.032 * strength})`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(bandLeft, yTop, bandRight - bandLeft, yBot - yTop);
    };

    if (this.corridorBias === 'target' && targetY != null) {
      paintBand(entryY, targetY, true);
    } else if (this.corridorBias === 'stop' && stopY != null) {
      paintBand(entryY, stopY, false);
    } else {
      if (targetY != null) paintBand(entryY, targetY, true);
      if (stopY != null) paintBand(entryY, stopY, false);
    }

    ctx.save();
    ctx.globalAlpha = 0.04 * strength;
    ctx.fillStyle = '#000';
    ctx.fillRect(bandLeft, 0, bandRight - bandLeft, h);
    ctx.restore();
  }

  private drawSessionShading(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.candles.length || this.replayMode) return;
    const ts = this.chart!.timeScale();
    let prevX: number | null = null;
    let prevSession: string | null = null;

    for (const c of this.candles) {
      const t = this.toChartTime(c.time);
      const x = ts.timeToCoordinate(t);
      if (x == null) continue;
      const session = this.sessionKind(c.time);
      if (prevX != null && prevSession && prevSession !== session) {
        ctx.fillStyle = 'rgba(139, 148, 158, 0.046)';
        ctx.fillRect(prevX, 0, x - prevX, h);
      }
      if (session === 'premarket') {
        ctx.fillStyle = 'rgba(88, 166, 255, 0.023)';
        ctx.fillRect(x - 4, 0, 8, h);
      } else if (session === 'opening') {
        ctx.fillStyle = 'rgba(255, 213, 79, 0.029)';
        ctx.fillRect(x - 4, 0, 8, h);
      } else if (session === 'overnight') {
        ctx.fillStyle = 'rgba(72, 79, 88, 0.035)';
        ctx.fillRect(x - 4, 0, 8, h);
      }
      prevX = x;
      prevSession = session;
    }
  }

  private sessionKind(iso: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(new Date(iso));
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
    const mins = hour * 60 + minute;
    if (mins < 240 || mins >= 1200) return 'overnight';
    if (mins < 570) return 'premarket';
    if (mins < 600) return 'opening';
    return 'regular';
  }

  private drawPriceBand(
    ctx: CanvasRenderingContext2D,
    low: number,
    high: number,
    fill: string,
    _label: string
  ): void {
    if (!this.candleSeries) return;
    const yTop = this.candleSeries.priceToCoordinate(Math.max(low, high));
    const yBot = this.candleSeries.priceToCoordinate(Math.min(low, high));
    if (yTop == null || yBot == null) return;
    ctx.fillStyle = fill;
    ctx.fillRect(0, Math.min(yTop, yBot), this.chartContainer.nativeElement.clientWidth, Math.abs(yBot - yTop));
  }

  scrollToLive(): void {
    this.followLatest = true;
    this.chart?.timeScale().scrollToRealTime();
  }

  private applyExecutionLevels(): void {
    if (!this.candleSeries) return;
    for (const line of this.priceLines) {
      this.candleSeries.removePriceLine(line);
    }
    this.priceLines = [];

    this.labelLayouts = this.annotationLane.annotate(
      this.overlayVisibility.filterLabels(
        this.labelCollision.layout(
          this.executionLevels,
          this.triggerLine?.price ?? null,
          this.triggerLine?.label ?? null
        ),
        this.zoomedOut
      ),
      this.triggerLine?.label ?? null
    );
    const hideAxis = new Set<string>();
    for (const a of this.labelLayouts) {
      for (const b of this.labelLayouts) {
        if (a.label === b.label) continue;
        const pct = Math.abs(a.price - b.price) / Math.max(a.price, 1);
        if (pct < 0.0015 && a.priority > b.priority && a.opacity < 1) {
          hideAxis.add(a.label);
        }
      }
    }

    const intel = this.overlayIntelService.emphasize(this.overlayIntel ?? {
      adaptiveExit: null,
      deterioration: null,
      failurePct: null,
      continuationRising: false,
      exitNow: false
    });

    for (const level of this.executionLevels) {
      const em = this.overlayIntelService.get(level.label, intel);
      if (!em.visible || !this.overlayVisibility.shouldShowLevel(level.label, this.zoomedOut)) continue;
      const layout = this.labelLayouts.find(l => l.label === level.label && l.price === level.price);
      const gravity = this.labelGravity?.[level.label] ?? 1;
      const opacity = Math.max(0.42, Math.min(layout?.opacity ?? 1, em.opacity) * em.axisBright * gravity);
      const lineColor = em.lineColor ?? level.color;
      const color = opacity < 0.65 ? lineColor.replace(/[\da-f]{2}$/i, '44') : lineColor;
      const pulsePhase = em.pulse ? 0.85 + (Date.now() % 2800) / 2800 * 0.15 : 1;
      this.priceLines.push(this.candleSeries.createPriceLine({
        price: level.price,
        color: em.pulse ? color : color,
        lineWidth: Math.min(4, Math.max(1, Math.round(em.lineWidth))) as 1 | 2 | 3 | 4,
        lineStyle: (level.lineStyle ?? 2) as 0 | 1 | 2 | 3,
        axisLabelVisible: false,
        title: ''
      }));
    }
    const prevEm = intel['Prev'];
    if (this.sessionPrevClose != null && this.sessionPrevClose > 0 && prevEm?.visible !== false) {
      const prevLayout = this.labelLayouts.find(l => l.label === 'Prev');
      this.priceLines.push(this.candleSeries.createPriceLine({
        price: this.sessionPrevClose,
        color: '#8b949e44',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: false,
        title: ''
      }));
    }
  }

  private onCrosshairMove(param: { time?: Time; seriesData?: Map<unknown, unknown>; point?: { x: number; y: number } }): void {
    const info = this.crosshairInfoEl?.nativeElement;
    const tooltip = this.tooltipEl?.nativeElement;
    if (!info || !tooltip) {
      return;
    }

    if (!param.time || !param.point) {
      info.style.display = 'none';
      tooltip.style.display = 'none';
      return;
    }

    const timeSec = param.time as number;
    const candle = this.candles.find(c => this.toChartTime(c.time) === timeSec);
    if (candle) {
      info.style.display = 'block';
      info.style.left = `${Math.min(param.point.x + 12, this.chartContainer.nativeElement.clientWidth - 160)}px`;
      info.style.top = '8px';
      info.textContent = `${this.formatEtTime(timeSec as Time)} · $${candle.close.toFixed(2)}`;
    } else {
      info.style.display = 'none';
    }

    const signal = this.signalByTime.get(timeSec);
    if (signal) {
      tooltip.style.display = 'block';
      tooltip.style.left = `${Math.min(param.point.x + 12, this.chartContainer.nativeElement.clientWidth - 240)}px`;
      tooltip.style.top = `${Math.max(param.point.y - 80, 8)}px`;
      tooltip.innerHTML = this.buildTooltipHtml(signal);
    } else {
      tooltip.style.display = 'none';
    }
  }

  private onChartClick(param: { time?: Time; point?: { x: number; y: number } }): void {
    if (!this.replayMode || !param.time || !this.replayEvents.length) return;
    const timeSec = param.time as number;
    const signal = this.signalByTime.get(timeSec);
    if (!signal) return;
    const replayEv = this.replayEvents.find(
      e => this.toChartTime(e.timestamp) === timeSec && e.signalType === signal.signalType
    );
    if (replayEv) {
      this.replayViewportUx.onSignalInspection();
      this.replayEventClick.emit(replayEv);
    }
  }

  private buildTooltipHtml(s: TradingSignal): string {
    if (this.replayMode) {
      const intel = this.replayReview.buildCandleIntel(s, this.replayCandleIndex, this.formatEtTime(this.toChartTime(s.timestamp)));
      if (intel) {
        return [
          `<strong>Bar ${intel.barIndex + 1}</strong>`,
          `<strong>${intel.decisionLabel}</strong>`,
          intel.convictionPct != null ? `Conviction ${intel.convictionPct}%` : '',
          `Narrative: ${intel.narrative}`,
          `Entry quality: ${intel.entryQuality}`,
          `Fakeout risk: ${intel.fakeoutRisk}`,
          intel.expectedR ? `Expected ${intel.expectedR}` : '',
          intel.actualR ? `Actual ${intel.actualR}` : '',
          `Price: $${s.price.toFixed(2)}`,
          this.formatEtTime(this.toChartTime(s.timestamp))
        ].filter(Boolean).join('<br>');
      }
    }
    const lines = [
      `<strong>${s.signalType.replace(/_/g, ' ')}</strong>`,
      s.freshnessLabel ? `Age: ${s.freshnessLabel}` : '',
      s.rankScore != null ? `Rank: ${s.rankScore}` : '',
      s.mtfSummary ? `MTF: ${s.mtfSummary}` : '',
      s.extended ? `<span class="warn">⚠ EXTENDED</span>` : '',
      `Price: $${s.price.toFixed(2)}`,
      s.rsi != null ? `RSI: ${s.rsi.toFixed(1)}` : '',
      s.macd != null ? `MACD: ${s.macd.toFixed(3)}` : '',
      s.relativeVolume != null ? `RelVol: ${s.relativeVolume.toFixed(1)}x` : '',
      s.vwap != null ? `VWAP: $${s.vwap.toFixed(2)}` : '',
      s.confidenceLabel ? `Confidence: ${s.confidenceLabel} (${s.confidenceScore}/4)` : '',
      s.signalReason ? `<span class="reason">${s.signalReason}</span>` : '',
      this.formatEtTime(this.toChartTime(s.timestamp))
    ].filter(Boolean);
    return lines.join('<br>');
  }

  private lineData(candles: Candle[], pick: (c: Candle) => number | null): LineData[] {
    return candles
      .filter(c => pick(c) != null)
      .map(c => ({ time: this.toChartTime(c.time), value: pick(c)! }));
  }

  private buildMarkers(): SeriesMarker<Time>[] {
    const candleTimes = new Set(this.candles.map(c => this.toChartTime(c.time) as number));
    const barIndexByTime = new Map<number, number>();
    this.candles.forEach((c, i) => barIndexByTime.set(this.toChartTime(c.time) as number, i));

    if (this.replayMode) {
      const markerSource = this.replayEvents.length ? this.replayEventsToSignals() : this.signals;
      const cacheKey = [
        this.symbol,
        this.replaySessionDate ?? '',
        this.replayStudyMode,
        this.candles.length,
        markerSource.length,
        this.replayStudyMode === 'TRAINING' ? this.replayCandleIndex : 'all'
      ].join(':');
      if (cacheKey === this.markerCacheKey && this.markerCache.length) {
        return this.markerCache;
      }
      const built = this.replayReview.signalOverlayEngine.buildProfessionalMarkers(
        markerSource,
        candleTimes,
        (ts, times) => this.snapToCandleTime(ts, times),
        this.replayStudyMode,
        this.replayCandleIndex,
        barIndexByTime,
        this.symbol,
        this.replaySessionDate
      );
      this.markerCacheKey = cacheKey;
      this.markerCache = built;
      return built;
    }

    this.markerCacheKey = '';
    this.markerCache = [];

    const seen = new Set<number>();
    const markers: SeriesMarker<Time>[] = [];

    const markerSource = this.signals
      .slice().sort((a, b) => this.markerPriority(a.signalType) - this.markerPriority(b.signalType));

    for (const s of markerSource) {
      const snapped = this.snapToCandleTime(s.timestamp, candleTimes);
      if (snapped == null || seen.has(snapped)) {
        continue;
      }
      seen.add(snapped);
      const time = snapped as Time;
      const color = this.markerColor(s);

      if (s.signalType === 'MOM_BUY') {
        markers.push({ time, position: 'belowBar', color, shape: 'arrowUp', text: '🚀 MOM' });
      } else if (s.signalType === 'PULL_BUY') {
        markers.push({ time, position: 'belowBar', color, shape: 'arrowUp', text: '📈 PULL' });
      } else if (s.signalType === 'CONT_BUY') {
        markers.push({ time, position: 'belowBar', color, shape: 'arrowUp', text: '▲ CONT' });
      } else if (s.signalType === 'OPEN_MOM_BUY') {
        markers.push({ time, position: 'belowBar', color, shape: 'arrowUp', text: '🚀 OPEN' });
      } else if (s.signalType === 'OPEN_SCOUT') {
        markers.push({ time, position: 'belowBar', color, shape: 'circle', text: '⚡ SCOUT' });
      } else if (s.signalType === 'OPEN_FAIL') {
        markers.push({ time, position: 'aboveBar', color, shape: 'arrowDown', text: '🔻 FAIL' });
      } else if (s.signalType === 'OPEN_FAIL_BREAK') {
        markers.push({ time, position: 'aboveBar', color: '#f97316', shape: 'arrowDown', text: '⬇ BREAK' });
      } else if (s.signalType === 'OPEN_FAIL_READY') {
        markers.push({ time, position: 'aboveBar', color: '#f8717180', shape: 'circle', text: '⚠ FAIL RDY' });
      } else if (s.signalType === 'RECOVERY_FAIL') {
        markers.push({ time, position: 'aboveBar', color: '#a855f7', shape: 'arrowDown', text: '📉 RECOVERY FAIL' });
      } else if (s.signalType === 'RECOVERY_FAIL_READY') {
        markers.push({ time, position: 'aboveBar', color: '#a855f780', shape: 'circle', text: '⚠ REC RDY' });
      } else if (s.signalType === 'IMBALANCE_DOWN') {
        markers.push({ time, position: 'aboveBar', color: '#dc2626', shape: 'arrowDown', text: '⬇ IMB DOWN' });
      } else if (s.signalType === 'IMBALANCE_UP') {
        markers.push({ time, position: 'belowBar', color: '#16a34a', shape: 'arrowUp', text: '⬆ IMB UP' });
      } else if (s.signalType === 'OPEN_READY') {
        markers.push({ time, position: 'belowBar', color: '#94a3b8', shape: 'circle', text: '◎ READY' });
      } else if (s.signalType === 'PULL_READY') {
        markers.push({ time, position: 'belowBar', color: '#22c55e80', shape: 'circle', text: '🟢 PULL RDY' });
      } else if (s.signalType === 'MOM_READY') {
        markers.push({ time, position: 'belowBar', color: '#26a69a80', shape: 'circle', text: '◉ MOM RDY' });
      } else if (s.signalType === 'CONT_READY') {
        markers.push({ time, position: 'belowBar', color: '#38bdf8', shape: 'circle', text: '◉ CONT' });
      } else if (s.signalType === 'EXIT') {
        markers.push({ time, position: 'aboveBar', color, shape: 'arrowDown', text: 'EXIT' });
      } else if (s.extended) {
        markers.push({ time, position: 'aboveBar', color: '#bc8cff', shape: 'circle', text: 'EXT' });
      }
    }

    if (this.tradeOverlay?.active && this.candles.length) {
      const entryTime = this.toChartTime(this.candles[this.candles.length - 1].time);
      const bullish = !this.tradeOverlay.statusLabel?.includes('EXIT');
      markers.push({
        time: entryTime,
        position: bullish ? 'belowBar' : 'aboveBar',
        color: '#22c55e',
        shape: 'circle',
        text: '▶ ENTRY'
      });
      markers.push({
        time: entryTime,
        position: bullish ? 'aboveBar' : 'belowBar',
        color: '#ef5350',
        shape: 'square',
        text: '✕ STOP'
      });
      if (this.tradeOverlay.rr != null) {
        markers.push({
          time: entryTime,
          position: bullish ? 'aboveBar' : 'belowBar',
          color: '#a371f7',
          shape: 'circle',
          text: `◎ ${this.tradeOverlay.rr}R`
        });
      }
    }

    return markers.sort((a, b) => (a.time as number) - (b.time as number));
  }

  private markerPriority(signalType: string): number {
    if (signalType === 'OPEN_SCOUT' || signalType === 'OPEN_MOM_BUY'
        || signalType === 'OPEN_FAIL' || signalType === 'OPEN_FAIL_BREAK'
        || signalType === 'RECOVERY_FAIL' || signalType === 'IMBALANCE_DOWN') {
      return 0;
    }
    if (signalType === 'IMBALANCE_UP') {
      return 1;
    }
    if (signalType.endsWith('_BUY') || signalType === 'EXIT') {
      return 1;
    }
    return 2;
  }

  private markerColor(s: TradingSignal): string {
    const life = s.lifecycleState;
    if (life === 'NEW') return '#22c55e';
    if (life === 'WEAKENING') return '#fbbf24';
    if (life === 'INVALIDATED') return '#ef5350';
    if (life === 'EXITED') return '#8b949e';
    if (s.extended) return '#bc8cff';
    if (s.signalType === 'MOM_BUY') return '#26a69a';
    if (s.signalType === 'PULL_BUY') return '#1f6feb';
    if (s.signalType === 'CONT_BUY') return '#0891b2';
    if (s.signalType === 'OPEN_MOM_BUY') return '#f97316';
    if (s.signalType === 'OPEN_SCOUT') return '#fbbf24';
    if (s.signalType === 'OPEN_FAIL') return '#ef5350';
    if (s.signalType === 'OPEN_FAIL_BREAK') return '#f97316';
    if (s.signalType === 'RECOVERY_FAIL') return '#a855f7';
    if (s.signalType === 'IMBALANCE_DOWN') return '#dc2626';
    if (s.signalType === 'IMBALANCE_UP') return '#16a34a';
    if (s.signalType === 'EXIT') return '#ef5350';
    return '#26a69a';
  }

  private replayEventsToSignals(): TradingSignal[] {
    return this.replayEvents
      .filter(e => e.lifecycleState === 'NEW' || e.lifecycleState === 'READY' || e.lifecycleState === 'EXITED')
      .map(e => signalToTradingSignal(e, this.symbol));
  }

  private snapToCandleTime(iso: string, candleTimes: Set<number>): number | null {
    const target = this.toChartTime(iso) as number;
    if (candleTimes.has(target)) {
      return target;
    }
    let best: number | null = null;
    let bestDiff = Infinity;
    for (const t of candleTimes) {
      const diff = Math.abs(t - target);
      if (diff < bestDiff && diff <= 300) {
        bestDiff = diff;
        best = t;
      }
    }
    return best;
  }

  private toChartTime(iso: string): Time {
    return Math.floor(new Date(iso).getTime() / 1000) as Time;
  }

  private formatEtTime(time: Time): string {
    const sec = typeof time === 'number' ? time : 0;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(sec * 1000));
  }

  /** Shorter format for x-axis tick labels. */
  private formatEtAxisTime(time: Time): string {
    const sec = typeof time === 'number' ? time : 0;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(sec * 1000));
  }

  macdLabel(): string {
    if (!this.indicators) return '—';
    return this.indicators.macd > this.indicators.signalLine ? 'Bullish' : 'Bearish';
  }

  macdClass(): string {
    return this.macdLabel() === 'Bullish' ? 'bullish' : 'bearish';
  }

  rsiClass(): string {
    if (!this.indicators) return 'neutral';
    if (this.indicators.rsi > 55) return 'bullish';
    if (this.indicators.rsi < 45) return 'bearish';
    return 'neutral';
  }

  relVolClass(): string {
    if (!this.indicators) return 'neutral';
    const rv = this.indicators.relativeVolume;
    if (rv > 2) return 'rv-high';
    if (rv > 1.5) return 'rv-mid';
    return 'neutral';
  }

  trendClass(): string {
    if (this.trendLabel.includes('Bullish')) return 'bullish';
    if (this.trendLabel.includes('Bearish')) return 'bearish';
    return 'neutral';
  }

  shortTrend(): string {
    if (this.trendLabel.includes('Bullish')) return 'Bull';
    if (this.trendLabel.includes('Bearish')) return 'Bear';
    return 'Flat';
  }
}
