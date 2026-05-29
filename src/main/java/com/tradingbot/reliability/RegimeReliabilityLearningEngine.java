package com.tradingbot.reliability;

import com.tradingbot.decisiontrace.ExitReasoningSnapshot;
import com.tradingbot.decisiontrace.SuppressionReasoningSnapshot;
import com.tradingbot.marketstructure.MarketEnvironmentState;
import com.tradingbot.marketstructure.MarketStructureAssessment;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.refinement.ContinuationCaptureEfficiency;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Phase 199 — learns per-regime reliability from closed telemetry (structure/session/RVOL fit).
 */
@Component
@RequiredArgsConstructor
public class RegimeReliabilityLearningEngine {

    private final ExecutionTelemetryRepository telemetryRepository;

    private final Map<String, RegimeReliabilityProfile> cache = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> rejectionPatterns = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> exitFailurePatterns = new ConcurrentHashMap<>();
    private volatile long cacheMs;

    public int rankingModifier(String regime, MarketStructureAssessment market, double rvol, String sessionPeriod) {
        RegimeReliabilityProfile p = profileFor(regime);
        if (p.sampleSize() < 3) return 0;

        int mod = p.rankingModifier();
        if (market != null) {
            if (regime != null && regime.toUpperCase(Locale.US).contains("CONTINUATION")) {
                if (market.primary() == MarketEnvironmentState.TREND_DAY_BULL && rvol >= 2.0) {
                    mod += 6;
                }
                if (market.tags().contains(MarketEnvironmentState.CHOP)
                        || market.tags().contains(MarketEnvironmentState.MIDDAY_DRIFT)) {
                    mod -= 10;
                }
            }
            if (market.tags().contains(MarketEnvironmentState.LOW_PARTICIPATION)) {
                mod -= 6;
            }
        }
        if ("MIDDAY".equalsIgnoreCase(sessionPeriod) && regime != null
                && regime.toUpperCase(Locale.US).contains("CONTINUATION")) {
            mod -= 8;
        }
        if (regime != null) {
            int chopRejections = rejectionPatternCount(regime, "MARKET");
            if (chopRejections >= 8) mod -= 4;
            AtomicInteger lowCap = exitFailurePatterns.get(normalize(regime) + "|LOW_CAPTURE");
            if (lowCap != null && lowCap.get() >= 5) mod -= 5;
        }
        return mod;
    }

    public RegimeReliabilityProfile profileFor(String regime) {
        refreshIfStale();
        return cache.getOrDefault(normalize(regime), RegimeReliabilityProfile.empty(regime));
    }

    /** Phase 201 — learn from persisted exit reasoning (persistence collapse, VWAP failure, etc.). */
    public void ingestExitReasoning(ExitReasoningSnapshot exit) {
        if (exit == null || exit.regime() == null) return;
        String key = normalize(exit.regime()) + "|" + exit.exitState();
        exitFailurePatterns.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet();
        if (exit.continuationCapturePct() != null && exit.continuationCapturePct() < 35) {
            exitFailurePatterns.computeIfAbsent(normalize(exit.regime()) + "|LOW_CAPTURE", k -> new AtomicInteger())
                    .incrementAndGet();
        }
        cacheMs = 0;
    }

    /** Phase 201 — learn from rejection/suppression reasoning for filter validation. */
    public void ingestRejectionReasoning(SuppressionReasoningSnapshot snap) {
        if (snap == null || snap.regime() == null) return;
        String key = normalize(snap.regime()) + "|" + snap.rejectionCategory();
        rejectionPatterns.computeIfAbsent(key, k -> new AtomicInteger()).incrementAndGet();
        if (!snap.autoEntryAllowed() && snap.entryQuality() != null) {
            rejectionPatterns.computeIfAbsent(
                    normalize(snap.regime()) + "|ENTRY_" + snap.entryQuality(), k -> new AtomicInteger())
                    .incrementAndGet();
        }
        cacheMs = 0;
    }

    public int rejectionPatternCount(String regime, String category) {
        AtomicInteger c = rejectionPatterns.get(normalize(regime) + "|" + category);
        return c != null ? c.get() : 0;
    }

    private void refreshIfStale() {
        long now = System.currentTimeMillis();
        if (now - cacheMs < 60_000 && !cache.isEmpty()) return;
        cache.clear();
        Map<String, Agg> agg = new ConcurrentHashMap<>();
        for (ExecutionTelemetryRecord t : telemetryRepository.findTop200ByClosedAtNotNullOrderByClosedAtDesc()) {
            if (t.getRegime() == null || t.getRealizedR() == null) continue;
            String key = normalize(t.getRegime());
            agg.compute(key, (k, a) -> {
                Agg cur = a == null ? new Agg() : a;
                cur.closed++;
                double r = t.getRealizedR().doubleValue();
                cur.sumR += r;
                if (r > 0) cur.wins++;
                double eff = ContinuationCaptureEfficiency.fromTelemetry(t);
                cur.effSum += eff;
                return cur;
            });
        }
        for (var e : agg.entrySet()) {
            Agg a = e.getValue();
            double winRate = a.closed > 0 ? (double) a.wins / a.closed : 0;
            double avgR = a.closed > 0 ? a.sumR / a.closed : 0;
            double eff = a.closed > 0 ? a.effSum / a.closed : 0;
            int mod = 0;
            String note = "Learning";
            if (a.closed >= 5 && winRate >= 0.55 && avgR > 0.2) {
                mod = 15;
                note = "Strong historical edge";
            } else if (a.closed >= 5 && winRate >= 0.45 && avgR > 0) {
                mod = 8;
            } else if (a.closed >= 5 && winRate < 0.35) {
                mod = -12;
                note = "Weak historical edge";
            }
            cache.put(e.getKey(), new RegimeReliabilityProfile(
                    e.getKey(), a.closed, winRate, avgR, eff, mod, note));
        }
        cacheMs = now;
    }

    private static String normalize(String regime) {
        return regime.toUpperCase(Locale.US).trim();
    }

    private static final class Agg {
        int closed;
        int wins;
        double sumR;
        double effSum;
    }
}
