package com.tradingbot.livetrader;

import com.tradingbot.alerts.TelegramAlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 185 — deduped telegram alerts for live operational app. */
@Service
@RequiredArgsConstructor
public class LiveTraderTelegramService {

    private final TelegramAlertService telegramAlertService;

    private final Map<String, Instant> lastSent = new ConcurrentHashMap<>();

    private static final long DOMINANT_COOLDOWN_SEC = 300;
    private static final long EMERGING_COOLDOWN_SEC = 240;
    private static final long EXIT_COOLDOWN_SEC = 180;
    private static final long REGIME_COOLDOWN_SEC = 600;

    public LiveTraderDtos.TelegramTickResultDto maybeAlert(
            String alertType,
            LiveTraderDtos.RankedOpportunityDto opp,
            int minDominance
    ) {
        if (opp == null) {
            return new LiveTraderDtos.TelegramTickResultDto(false, alertType, null, "no opportunity");
        }
        if (opp.dominanceScore() < minDominance) {
            return new LiveTraderDtos.TelegramTickResultDto(false, alertType, opp.symbol(), "below threshold");
        }
        String key = alertType + ":" + opp.symbol() + ":" + opp.regime();
        long cooldownSec = cooldownFor(alertType);
        Instant last = lastSent.get(key);
        if (last != null && Instant.now().isBefore(last.plusSeconds(cooldownSec))) {
            return new LiveTraderDtos.TelegramTickResultDto(false, alertType, opp.symbol(), "cooldown");
        }
        String msg = formatMessage(alertType, opp);
        boolean sent = telegramAlertService.sendOperationalAlert(msg);
        if (sent) lastSent.put(key, Instant.now());
        return new LiveTraderDtos.TelegramTickResultDto(sent, alertType, opp.symbol(), sent ? "sent" : "telegram not configured");
    }

    private long cooldownFor(String type) {
        return switch (type) {
            case "DOMINANT_NOW", "INSTITUTIONAL_FLOW", "SECOND_LEG_DOMINANCE" -> DOMINANT_COOLDOWN_SEC;
            case "EMERGING_FAST" -> EMERGING_COOLDOWN_SEC;
            case "EXIT_WARNING", "EXHAUSTION_RISK" -> EXIT_COOLDOWN_SEC;
            case "MARKET_REGIME_SHIFT", "MARKET_SHIFT" -> REGIME_COOLDOWN_SEC;
            case "PAPER_ENTRY_EXECUTED" -> 120;
            default -> 300;
        };
    }

    private String formatMessage(String type, LiveTraderDtos.RankedOpportunityDto o) {
        return """
                🔶 %s
                %s · %s
                Conviction %d · Persistence %ds · Dom %d
                %s
                """.formatted(
                type,
                o.symbol(),
                o.regime(),
                o.conviction(),
                o.persistenceSeconds(),
                o.dominanceScore(),
                o.whyNow().isEmpty() ? "—" : String.join(" · ", o.whyNow().stream().limit(2).toList())
        ).trim();
    }
}
