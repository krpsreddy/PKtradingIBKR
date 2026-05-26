package com.tradingbot.intelligence;

import com.tradingbot.intelligence.dto.SignalFreshnessDto;
import com.tradingbot.services.MarketTime;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
public class SignalFreshnessService {

    public SignalFreshnessDto evaluate(LocalDateTime signalTime) {
        if (signalTime == null) {
            return fresh(0);
        }
        long ageMin = Math.max(0, ChronoUnit.MINUTES.between(signalTime, MarketTime.nowLocal()));
        if (ageMin <= 2) {
            return fresh(ageMin);
        }
        if (ageMin <= 5) {
            return active(ageMin);
        }
        if (ageMin <= 15) {
            return aging(ageMin);
        }
        return stale(ageMin);
    }

    public int freshnessPenalty(SignalFreshnessDto freshness) {
        if (freshness == null) {
            return 0;
        }
        return switch (freshness.getFreshness()) {
            case "FRESH" -> 0;
            case "ACTIVE" -> 1;
            case "AGING" -> 2;
            case "STALE" -> 4;
            default -> 0;
        };
    }

    private SignalFreshnessDto fresh(long ageMin) {
        return SignalFreshnessDto.builder()
                .freshness("FRESH")
                .ageMinutes(ageMin)
                .ageLabel(ageMin <= 0 ? "NEW" : ageMin + "m ago")
                .freshnessScore(100)
                .staleForOptions(false)
                .build();
    }

    private SignalFreshnessDto active(long ageMin) {
        return SignalFreshnessDto.builder()
                .freshness("ACTIVE")
                .ageMinutes(ageMin)
                .ageLabel(ageMin + "m ago")
                .freshnessScore(75)
                .staleForOptions(false)
                .build();
    }

    private SignalFreshnessDto aging(long ageMin) {
        return SignalFreshnessDto.builder()
                .freshness("AGING")
                .ageMinutes(ageMin)
                .ageLabel(ageMin + "m ago")
                .freshnessScore(45)
                .staleForOptions(true)
                .build();
    }

    private SignalFreshnessDto stale(long ageMin) {
        return SignalFreshnessDto.builder()
                .freshness("STALE")
                .ageMinutes(ageMin)
                .ageLabel(ageMin + "m ago")
                .freshnessScore(15)
                .staleForOptions(true)
                .build();
    }
}
