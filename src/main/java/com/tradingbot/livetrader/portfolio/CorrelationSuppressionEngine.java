package com.tradingbot.livetrader.portfolio;

import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Phase 189 — lightweight sector clusters (no heavy correlation math).
 */
@Component
public class CorrelationSuppressionEngine {

    private static final Map<String, Set<String>> CLUSTERS = buildClusters();

    private static Map<String, Set<String>> buildClusters() {
        Map<String, Set<String>> m = new LinkedHashMap<>();
        put(m, "SEMIS", "NVDA", "AMD", "MU", "AVGO", "QCOM", "MRVL", "AMAT", "LRCX", "KLAC", "INTC");
        put(m, "AI", "NVDA", "PLTR", "SNOW", "AI", "PATH", "DDOG", "CRWD");
        put(m, "EV", "RIVN", "TSLA", "LCID", "NIO", "FSR");
        put(m, "MEGA_TECH", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "AAPL");
        return Map.copyOf(m);
    }

    private static void put(Map<String, Set<String>> m, String cluster, String... symbols) {
        Set<String> set = new HashSet<>();
        for (String s : symbols) {
            set.add(s.toUpperCase(Locale.US));
        }
        m.put(cluster, Collections.unmodifiableSet(set));
    }

    public String clusterFor(String symbol) {
        if (symbol == null) return "OTHER";
        String sym = symbol.toUpperCase(Locale.US);
        for (var e : CLUSTERS.entrySet()) {
            if (e.getValue().contains(sym)) {
                return e.getKey();
            }
        }
        return "OTHER";
    }

    public Optional<String> suppressionReason(String activeSymbol, String candidateSymbol) {
        if (activeSymbol == null || candidateSymbol == null) return Optional.empty();
        String activeCluster = clusterFor(activeSymbol);
        String candidateCluster = clusterFor(candidateSymbol);
        if ("OTHER".equals(activeCluster) || "OTHER".equals(candidateCluster)) {
            return Optional.empty();
        }
        if (activeCluster.equals(candidateCluster) && !activeSymbol.equalsIgnoreCase(candidateSymbol)) {
            return Optional.of(displayName(activeCluster) + " exposure already active");
        }
        return Optional.empty();
    }

    private static String displayName(String cluster) {
        return switch (cluster) {
            case "SEMIS" -> "Semiconductor";
            case "AI" -> "AI";
            case "EV" -> "EV";
            case "MEGA_TECH" -> "Mega-cap tech";
            default -> cluster;
        };
    }
}
