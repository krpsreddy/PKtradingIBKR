package com.tradingbot.executionreview;

import com.tradingbot.models.ExecutionTelemetryRecord;
import org.springframework.stereotype.Component;

/** Phase 190 — classify entry timing vs setup quality. */
@Component
public class EntryQualityReviewEngine {

    public String classify(ExecutionTelemetryRecord t) {
        String lifecycle = safe(t.getLifecycle());
        String quality = safe(t.getExecutionQuality());
        int dom = nz(t.getDominance());
        int conv = nz(t.getConviction());
        int persist = nz(t.getPersistence());

        if ("EXHAUSTING".equals(lifecycle) || "FAILED".equals(lifecycle)) {
            return "LATE";
        }
        if ("EXTENDED".equals(lifecycle) || dom >= 185) {
            return "EXTENDED";
        }
        if ("DEVELOPING".equals(lifecycle)) {
            return "EARLY";
        }
        if (dom >= 170 && conv >= 80 && !"LOW".equalsIgnoreCase(quality)) {
            return "CHASED";
        }
        if ("LOW".equalsIgnoreCase(quality) || conv < 60 || persist < 30) {
            return "WEAK";
        }
        if (("CONFIRMED".equals(lifecycle) || "PERSISTING".equals(lifecycle))
                && ("HIGH".equalsIgnoreCase(quality) || "INSTITUTIONAL".equalsIgnoreCase(quality))
                && dom >= 115 && conv >= 72) {
            return "IDEAL";
        }
        if (conv >= 70 && dom >= 100) {
            return "IDEAL";
        }
        return "WEAK";
    }

    private static String safe(String s) {
        return s == null ? "" : s.toUpperCase();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
