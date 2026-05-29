package com.tradingbot.intelligence.snapshot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradingbot.analytics.storage.AnalyticsVersionService;
import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;
import com.tradingbot.analytics.storage.repository.EvaluatedSignalSnapshotRepository;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Phase 164 — precomputed intelligence snapshots (server-side only). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IntelligenceSnapshotService {

    private static final ZoneId ET = ZoneId.of("America/New_York");
    private static final int DEFAULT_LOOKBACK_DAYS = 60;

    private final EvaluatedSignalSnapshotRepository snapshotRepository;
    private final AnalyticsVersionService versionService;
    private final IntelligenceScoringEngine scoringEngine;
    private final ObjectMapper objectMapper;

    public LiveRegimeSnapshotDto liveRegime(String symbol, Integer lookbackDays) {
        String sym = symbol.toUpperCase(Locale.US);
        int days = lookbackDays != null ? lookbackDays : DEFAULT_LOOKBACK_DAYS;
        List<IntelligenceSignalContext> contexts = loadSymbolContexts(sym, days);
        int version = versionService.currentVersion();

        List<ActiveRegimeRowDto> active = new ArrayList<>();
        List<ParticipationOpportunityDto> opportunities = new ArrayList<>();

        for (IntelligenceSignalContext ctx : contexts) {
            IntelligenceScoringEngine.Scores s = scoringEngine.score(ctx);
            if (s.continuationPersistence() < 45) continue;
            String regime = scoringEngine.detectRegimeType(ctx, s);
            String classification = scoringEngine.classifyRegime(ctx, s);
            active.add(new ActiveRegimeRowDto(
                    ctx.symbol(), regime, classification, s.expansionProbability(),
                    s.continuationPersistence(), ctx.sessionTimeMinutes()
            ));
            IntelligenceScoringEngine.TriggerResult t = scoringEngine.trigger(ctx, s);
            if (t.active() && !"DO_NOT_CHASE".equals(t.traderAction()) && !"LATE_STAGE_EXHAUSTION".equals(t.traderAction())) {
                opportunities.add(new ParticipationOpportunityDto(
                        ctx.symbol(), classification, s.expansionProbability(),
                        s.pullbackEfficiency(), windowLabel(ctx.sessionTimeMinutes()), t.triggerReason()
                ));
            }
        }

        active.sort(Comparator.comparingInt(ActiveRegimeRowDto::continuationPersistenceScore).reversed());
        opportunities.sort(Comparator.comparingInt(ParticipationOpportunityDto::expansionProbability).reversed());

        return new LiveRegimeSnapshotDto(
                true, days, Instant.now().toEpochMilli(), version, contexts.size(),
                active.stream().limit(20).toList(),
                opportunities.stream().limit(20).toList(),
                buildRegimeInsights(contexts.size(), active.size(), opportunities.size())
        );
    }

    public ExecutionCardsSnapshotDto executionCards(String symbol, Integer lookbackDays) {
        String sym = symbol.toUpperCase(Locale.US);
        int days = lookbackDays != null ? lookbackDays : DEFAULT_LOOKBACK_DAYS;
        List<IntelligenceSignalContext> contexts = loadSymbolContexts(sym, days);
        int version = versionService.currentVersion();
        List<ExecutionCardDto> cards = new ArrayList<>();

        for (IntelligenceSignalContext ctx : contexts) {
            IntelligenceScoringEngine.Scores s = scoringEngine.score(ctx);
            IntelligenceScoringEngine.TriggerResult t = scoringEngine.trigger(ctx, s);
            if (!t.active() || t.triggerType() == null || t.triggerType().isBlank()) continue;
            if ("DO_NOT_CHASE".equals(t.traderAction()) || "LATE_STAGE_EXHAUSTION".equals(t.traderAction())) continue;
            cards.add(toCard(ctx, s, t));
        }

        cards.sort(Comparator.comparingInt(c -> -c.expansionProbability()));
        return new ExecutionCardsSnapshotDto(
                true, Instant.now().toEpochMilli(), version, sym,
                cards.stream().limit(20).toList(),
                List.of(
                        cards.size() + " actionable execution cards for " + sym,
                        "Precomputed server-side — no browser rescoring",
                        "Advisory only"
                )
        );
    }

    public ReplayTriggerSnapshotDto replayTrigger(String symbol, String session) {
        ReplayTimelineSnapshotDto timeline = replayTimeline(symbol, session);
        List<IntelligenceBarSnapshotDto> triggers = timeline.bars().stream()
                .filter(b -> b.triggerType() != null && !b.triggerType().isBlank())
                .toList();
        return new ReplayTriggerSnapshotDto(
                true, timeline.generatedAt(), timeline.analyticsVersion(),
                timeline.symbol(), timeline.sessionDate(),
                triggers, timeline.replayMarkers(), timeline.timelineEvents(),
                List.of(
                        triggers.size() + " trigger moments in session " + session,
                        "Video-playback mode — markers precomputed",
                        "Advisory only"
                )
        );
    }

    public ReplayTimelineSnapshotDto replayTimeline(String symbol, String session) {
        String sym = symbol.toUpperCase(Locale.US);
        LocalDate sessionDate = LocalDate.parse(session);
        int version = versionService.currentVersion();
        List<EvaluatedSignalSnapshotEntity> entities = snapshotRepository
                .findBySymbolAndSessionDateAndAnalyticsVersionOrderByTimestampMsAsc(sym, sessionDate, version);

        List<IntelligenceBarSnapshotDto> bars = new ArrayList<>();
        List<ReplayMarkerDto> markers = new ArrayList<>();
        List<TimelineEventDto> events = new ArrayList<>();
        int barIdx = 0;
        int addCount = 0;
        int exhaustCount = 0;
        String dominantRegime = "INSTITUTIONAL_PERSISTENCE";

        for (EvaluatedSignalSnapshotEntity e : entities) {
            IntelligenceSignalContext ctx = toContext(e, barIdx++);
            IntelligenceScoringEngine.Scores s = scoringEngine.score(ctx);
            IntelligenceScoringEngine.TriggerResult t = scoringEngine.trigger(ctx, s);
            IdealEntryZoneDto zone = idealZone(ctx);
            String markerText = t.triggerType() != null && !t.triggerType().isBlank()
                    ? IntelligenceScoringEngine.markerText(t.triggerType(), t.triggerScore())
                    : "";
            String color = IntelligenceScoringEngine.markerColor(t.chartZone());

            bars.add(new IntelligenceBarSnapshotDto(
                    ctx.symbol(), ctx.sessionDate(), ctx.barIndex(), ctx.timestampMs(),
                    t.regimeType(), t.classification(), t.triggerType(), t.traderAction(),
                    s.continuationIntegrity(), s.expansionProbability(), s.exhaustionDrift(),
                    zone, t.chartZone(), markerText, color,
                    t.active() ? "arrowUp" : "circle",
                    "EXHAUSTION_DEVELOPING".equals(t.chartZone()) ? "aboveBar" : "belowBar",
                    t.addOpportunity(), t.triggerReason(), t.whyValid()
            ));

            if (t.active() && !markerText.isBlank()) {
                markers.add(new ReplayMarkerDto(ctx.timestampMs(), markerText.split("\n")[0], color,
                        "EXHAUSTION_DEVELOPING".equals(t.chartZone()) ? "circle" : "arrowUp",
                        "EXHAUSTION_DEVELOPING".equals(t.chartZone()) ? "aboveBar" : "belowBar"));
            }

            if (t.active()) {
                events.add(new TimelineEventDto(
                        ctx.timestampMs(),
                        formatTime(ctx.timestampMs()),
                        t.triggerType() != null ? t.triggerType() : t.traderAction(),
                        t.traderAction().replace('_', ' '),
                        t.whyValid(),
                        t.triggerScore()
                ));
                if (t.addOpportunity()) addCount++;
                if ("LATE_STAGE_EXHAUSTION".equals(t.traderAction()) || "DO_NOT_CHASE".equals(t.traderAction())) {
                    exhaustCount++;
                }
                if (t.regimeType() != null && !t.regimeType().isBlank()) dominantRegime = t.regimeType();
            }
        }

        return new ReplayTimelineSnapshotDto(
                true, Instant.now().toEpochMilli(), version, sym, session,
                bars, markers, events,
                new VisualizationPayloadDto(bars.size(), addCount, exhaustCount, dominantRegime)
        );
    }

    /** Phase 165 — batch autonomous opportunity scanner across symbols. */
    public ScannerSnapshotDto scannerOpportunities(List<String> symbols, Integer lookbackDays) {
        int days = lookbackDays != null ? lookbackDays : DEFAULT_LOOKBACK_DAYS;
        List<String> normalized = symbols.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(s -> s.toUpperCase(Locale.US))
                .distinct()
                .toList();

        List<ScannerOpportunityDto> opportunities = new ArrayList<>();
        for (String sym : normalized) {
            ExecutionCardsSnapshotDto cards = executionCards(sym, days);
            LiveRegimeSnapshotDto regime = liveRegime(sym, days);
            ExecutionCardDto top = cards.cards().isEmpty() ? null : cards.cards().get(0);
            ActiveRegimeRowDto active = regime.activeContinuationRegimes().stream()
                    .filter(r -> sym.equals(r.symbol()))
                    .findFirst()
                    .orElse(regime.activeContinuationRegimes().isEmpty() ? null : regime.activeContinuationRegimes().get(0));
            if (top == null && active == null) continue;
            opportunities.add(toScannerOpportunity(sym, top, active));
        }

        opportunities.sort(Comparator.comparingInt(ScannerOpportunityDto::convictionScore).reversed());

        return new ScannerSnapshotDto(
                true,
                Instant.now().toEpochMilli(),
                normalized,
                opportunities,
                List.of(
                        opportunities.size() + " autonomous opportunities ranked",
                        "Server-side scanner · no browser rescoring",
                        "Advisory only"
                )
        );
    }

    private ScannerOpportunityDto toScannerOpportunity(String sym, ExecutionCardDto card, ActiveRegimeRowDto regime) {
        String entryType = card != null ? card.entryType() : (regime != null ? regime.regimeType() : "");
        String action = card != null ? card.action() : "WATCH";
        String classification = regime != null ? regime.classification() : "";
        String opportunityType = mapOpportunityType(entryType, action, classification);
        String traderAction = mapTraderAction(opportunityType, action);
        String tone = mapTone(opportunityType);
        String badge = mapBadge(opportunityType);

        int expansion = card != null ? card.expansionProbability() : (regime != null ? regime.expansionProbability() : 50);
        int persistence = regime != null ? regime.continuationPersistenceScore() : (int) Math.round(expansion * 0.85);
        int triggerIntegrity = card != null ? integrityFromLabel(card.continuationIntegrity()) : 62;
        int institutional = entryType.toUpperCase(Locale.US).contains("INSTITUTIONAL")
                || entryType.toUpperCase(Locale.US).contains("ORB") ? 85 : 58;
        int exhaustion = Math.max(0, Math.min(100, 100 - expansion - (int) (persistence * 0.15)));
        int executionQuality = Math.max(0, Math.min(100,
                (int) Math.round(expansion * 0.35 + triggerIntegrity * 0.35 + persistence * 0.3)));
        int conviction = computeConviction(opportunityType, expansion, persistence, triggerIntegrity, institutional, exhaustion, executionQuality);

        List<String> whyNow = new ArrayList<>();
        if (card != null) {
            if (card.rvolLabel() != null && !card.rvolLabel().isBlank()) whyNow.add("RVOL " + card.rvolLabel());
            if (card.vwapPersistenceLabel() != null && !card.vwapPersistenceLabel().isBlank()) {
                whyNow.add("VWAP " + card.vwapPersistenceLabel().toLowerCase(Locale.US));
            }
            if (card.shallowPbQuality() != null && !card.shallowPbQuality().isBlank()) {
                whyNow.add("shallow PB " + card.shallowPbQuality().toLowerCase(Locale.US));
            }
            if (triggerIntegrity >= 70) whyNow.add("continuation integrity HIGH");
            if (card.triggerReason() != null && !card.triggerReason().isBlank() && whyNow.size() < 3) {
                whyNow.add(card.triggerReason());
            }
        }
        if (exhaustion >= 55) whyNow.add("exhaustion drift detected");

        String entryZone = card != null && card.idealEntryZone() != null
                ? String.format(Locale.US, "%.2f–%.2f", card.idealEntryZone().low(), card.idealEntryZone().high())
                : "—";
        String risk = card != null ? card.continuationRisk() : ("LATE_STAGE_EXHAUSTION".equals(opportunityType) ? "HIGH" : "LOW");
        String window = card != null ? card.windowLabel() : "—";
        String rvol = card != null ? card.rvolLabel() : "—";

        return ScannerOpportunityDto.base(
                sym, opportunityType, traderAction, tone, badge, conviction,
                expansion, persistence, triggerIntegrity, institutional, exhaustion, executionQuality,
                entryZone, risk, whyNow.stream().limit(4).toList(), window, rvol
        );
    }

    private static int computeConviction(String type, int expansion, int persistence, int integrity,
                                         int institutional, int exhaustion, int executionQuality) {
        if ("LATE_STAGE_EXHAUSTION".equals(type)) {
            return Math.max(0, Math.min(100, (int) Math.round(100 - exhaustion * 0.6)));
        }
        int exhaustionInverse = 100 - exhaustion;
        double raw = persistence * 0.22 + expansion * 0.20 + integrity * 0.16 + institutional * 0.12
                + executionQuality * 0.14 + exhaustionInverse * 0.16;
        return Math.max(0, Math.min(100, (int) Math.round(raw)));
    }

    private static int integrityFromLabel(String label) {
        if (label == null) return 62;
        String u = label.toUpperCase(Locale.US);
        if (u.contains("HIGH") || u.contains("STRONG")) return 88;
        if (u.contains("MODERATE") || u.contains("MEDIUM") || u.contains("SOLID")) return 68;
        if (u.contains("LOW") || u.contains("WEAK")) return 42;
        return 62;
    }

    private static String mapOpportunityType(String entryType, String action, String classification) {
        String e = entryType != null ? entryType.toUpperCase(Locale.US) : "";
        String a = action != null ? action.toUpperCase(Locale.US) : "";
        String c = classification != null ? classification.toUpperCase(Locale.US) : "";
        if (a.contains("EXHAUSTION") || e.contains("EXHAUSTION") || c.contains("EXHAUSTION")) return "LATE_STAGE_EXHAUSTION";
        if (e.contains("SHALLOW") || c.contains("PULLBACK")) return "SHALLOW_PULLBACK_CONTINUATION";
        if (e.contains("VWAP")) return "VWAP_PERSISTENCE";
        if (e.contains("COMPRESSION") || e.contains("MICRO")) return "COMPRESSION_RELEASE";
        if (e.contains("ORB") || e.contains("ACCELERATION") || c.contains("ACCELERATION")) return "INSTITUTIONAL_ACCELERATION";
        if (e.contains("RESUMPTION")) return "TREND_RESUMPTION";
        return "EARLY_CONTINUATION";
    }

    private static String mapTraderAction(String type, String action) {
        if ("LATE_STAGE_EXHAUSTION".equals(type)) return "AVOID";
        String a = action != null ? action.toUpperCase(Locale.US) : "";
        if (a.contains("ADD")) return "ADD";
        if (a.contains("EXHAUSTION") || a.contains("CHASE")) return "AVOID";
        if (a.contains("WAIT") || a.contains("WATCH")) return "WATCH";
        return "ENTER";
    }

    private static String mapTone(String type) {
        return switch (type) {
            case "LATE_STAGE_EXHAUSTION" -> "RED";
            case "TREND_RESUMPTION" -> "ORANGE";
            case "SHALLOW_PULLBACK_CONTINUATION" -> "YELLOW";
            default -> "GREEN";
        };
    }

    private static String mapBadge(String type) {
        return switch (type) {
            case "EARLY_CONTINUATION" -> "🟢 HIGH CONTINUATION";
            case "SHALLOW_PULLBACK_CONTINUATION" -> "🟡 HEALTHY PULLBACK";
            case "VWAP_PERSISTENCE" -> "🟢 VWAP PERSISTENCE";
            case "INSTITUTIONAL_ACCELERATION" -> "🟢 INSTITUTIONAL PERSISTENCE";
            case "COMPRESSION_RELEASE" -> "🟢 COMPRESSION BREAKOUT";
            case "TREND_RESUMPTION" -> "🟠 LATE EXTENSION";
            case "LATE_STAGE_EXHAUSTION" -> "🔴 EXHAUSTION DEVELOPING";
            default -> "🟢 EARLY EXPANSION";
        };
    }

    private List<IntelligenceSignalContext> loadSymbolContexts(String symbol, int lookbackDays) {
        LocalDate since = LocalDate.now(ET).minusDays(lookbackDays);
        int version = versionService.currentVersion();
        return snapshotRepository.findBySymbolAndSessionDateGreaterThanEqualAndAnalyticsVersionOrderByTimestampMsDesc(
                        symbol, since, version)
                .stream()
                .map(e -> toContext(e, 0))
                .toList();
    }

    private IntelligenceSignalContext toContext(EvaluatedSignalSnapshotEntity e, int barIndex) {
        JsonNode p = readPayload(e.getPayload());
        Double rvol = dbl(p, "rvol");
        Double vwapDist = dbl(p, "vwapDistance");
        Double trend = dbl(p, "trendAlignment");
        if (trend == null) trend = dbl(p, "convictionScore");
        Double vol = dbl(p, "volatility");
        Double price = dbl(p, "entryPrice");
        Integer sessionMins = p != null && p.path("sessionTimeMinutes").isNumber()
                ? p.path("sessionTimeMinutes").asInt() : null;
        Boolean extended = p != null && p.has("extendedEntry") ? p.path("extendedEntry").asBoolean() : null;
        double mfeR = e.getMfe() != null ? e.getMfe() : 0;
        if (p != null && p.path("evaluation").path("mfeR").isNumber()) {
            mfeR = p.path("evaluation").path("mfeR").asDouble();
        }
        String sessionDate = e.getSessionDate() != null
                ? e.getSessionDate().toString()
                : LocalDate.ofInstant(Instant.ofEpochMilli(e.getTimestampMs()), ET).toString();
        return new IntelligenceSignalContext(
                e.getSignalId(), e.getSymbol(), sessionDate, e.getTimestampMs(), barIndex,
                e.getRegime(), e.getSetup(), rvol, vwapDist, trend,
                trend, extended, vol, price, sessionMins, mfeR
        );
    }

    private ExecutionCardDto toCard(IntelligenceSignalContext ctx, IntelligenceScoringEngine.Scores s,
                                    IntelligenceScoringEngine.TriggerResult t) {
        return new ExecutionCardDto(
                ctx.symbol(),
                t.traderAction(),
                t.triggerType(),
                qualityLabel(s.continuationIntegrity()),
                String.format(Locale.US, "%.1fx sustained", ctx.rvol() != null ? ctx.rvol() : 0),
                qualityLabel(s.pullbackEfficiency()),
                IntelligenceScoringEngine.vwapPersistenceMinutes(ctx) + "m",
                s.expansionProbability(),
                idealZone(ctx),
                riskLabel(s.continuationIntegrity()),
                t.triggerReason(),
                windowLabel(ctx.sessionTimeMinutes())
        );
    }

    private IdealEntryZoneDto idealZone(IntelligenceSignalContext ctx) {
        if (ctx.entryPrice() == null || ctx.entryPrice() <= 0) return null;
        double band = Math.max(0.0015, Math.abs(ctx.vwapDistance() != null ? ctx.vwapDistance() : 0.008) * 0.6);
        double low = round2(ctx.entryPrice() * (1 - band));
        double high = round2(ctx.entryPrice() * (1 + band * 0.5));
        return new IdealEntryZoneDto(low, high, String.format(Locale.US, "%.2f–%.2f", low, high));
    }

    private JsonNode readPayload(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            return null;
        }
    }

    private Double dbl(JsonNode p, String field) {
        return p != null && p.path(field).isNumber() ? p.path(field).asDouble() : null;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static String formatTime(long ts) {
        return DateTimeFormatter.ofPattern("HH:mm").withZone(ET).format(Instant.ofEpochMilli(ts));
    }

    private static String qualityLabel(int score) {
        if (score >= 75) return "STRONG";
        if (score >= 58) return "SOLID";
        if (score >= 45) return "MODERATE";
        return "WEAK";
    }

    private static String riskLabel(int integrity) {
        if (integrity >= 70) return "LOW";
        if (integrity >= 55) return "MODERATE";
        if (integrity >= 40) return "ELEVATED";
        return "HIGH";
    }

    private static String windowLabel(Integer mins) {
        if (mins == null) return "session";
        if (mins <= 15) return "9:35–10:15 opening continuation";
        if (mins <= 45) return "10:15–11:00 shallow pullback persistence";
        if (mins <= 120) return "midday compression release";
        return "trend resumption after digestion";
    }

    private static List<String> buildRegimeInsights(int sample, int active, int opps) {
        List<String> lines = new ArrayList<>();
        if (sample < 10) lines.add("Insufficient sample — hydrate history before trusting regime detection.");
        lines.add(active + " continuation regimes in " + sample + " evaluated signals.");
        lines.add(opps + " participation opportunities (server-precomputed).");
        lines.add("Advisory only — frontend does not rescore.");
        return lines;
    }
}
