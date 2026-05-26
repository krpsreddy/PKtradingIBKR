package com.tradingbot.intelligence.historical;

import com.tradingbot.api.dto.historical.HistoricalDtos.SessionFingerprintDto;
import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import com.tradingbot.services.MarketTrendService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SessionFingerprintService {

    private final SignalOutcomeRepository outcomeRepository;
    private final MarketTrendService marketTrendService;
    private final TradingProperties tradingProperties;

    public SessionFingerprintDto fingerprint(LocalDate date) {
        var trend = marketTrendService.getMarketTrend();
        List<SignalOutcome> day = outcomeRepository.findBySessionDateOrderByRecordedAtDesc(date);

        long wins = day.stream().filter(o -> "WIN".equals(o.getOutcome())).count();
        long losses = day.stream().filter(o -> "LOSS".equals(o.getOutcome())).count();
        long contWins = day.stream().filter(o -> "WIN".equals(o.getOutcome()) && isCont(o)).count();

        String fingerprint;
        String description;
        int confidence = 60;
        List<String> traits = new ArrayList<>();

        if (trend != null && trend.isChoppy()) {
            fingerprint = "chop heavy";
            description = "Oscillating price action — mean-reversion and failed breakouts dominate.";
            traits.add("CHOPPY regime");
        } else if (contWins >= 2 && wins > losses) {
            fingerprint = "trend persistence";
            description = "Continuation setups delivering — trends holding through midday.";
            traits.add("CONT strength");
            confidence = 75;
        } else if (losses >= 3 && wins == 0) {
            fingerprint = "reversal heavy";
            description = "Opening moves failing — fade risk elevated.";
            traits.add("Failed follow-through");
        } else if (trend != null && trend.getRiskOnScore() != null && trend.getRiskOnScore() >= 70) {
            fingerprint = "high participation";
            description = "Broad participation with strong risk-on breadth.";
            traits.add("Risk-on");
        } else if (trend != null && "WEAK".equals(trend.getSemiBreadth())) {
            fingerprint = "weak breadth";
            description = "Leadership narrow — be selective on sector leaders only.";
            traits.add("Weak semi breadth");
        } else {
            fingerprint = "rotational";
            description = "Sector rotation without clear trend persistence.";
            traits.add("Mixed leadership");
        }

        return SessionFingerprintDto.builder()
                .sessionDate(date.toString())
                .fingerprint(fingerprint)
                .description(description)
                .confidence(confidence)
                .traits(traits)
                .build();
    }

    public SessionFingerprintDto today() {
        return fingerprint(MarketTime.nowLocal().toLocalDate());
    }

    private boolean isCont(SignalOutcome o) {
        String t = o.getSetupType();
        return t != null && t.toUpperCase(Locale.ROOT).contains("CONT");
    }
}
