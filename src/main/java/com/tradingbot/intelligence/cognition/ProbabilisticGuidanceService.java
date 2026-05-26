package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.cognition.CognitionPartDtos.ProbabilisticGuidanceDto;
import com.tradingbot.config.TradingProperties;
import com.tradingbot.intelligence.AdaptiveRankingService;
import com.tradingbot.intelligence.dto.ExecutionIntelligenceDto;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ProbabilisticGuidanceService {

    private final AdaptiveRankingService adaptiveRankingService;
    private final SignalOutcomeRepository outcomeRepository;
    private final TradingProperties tradingProperties;

    public ProbabilisticGuidanceDto guide(String signalType, String regime, ExecutionIntelligenceDto exec) {
        String sig = signalType != null ? signalType : "CONT_BUY";
        String reg = regime != null ? regime : "TRENDING_BULL";

        double contWr = adaptiveRankingService.winRate("CONT_BUY", reg);
        double openWr = adaptiveRankingService.winRate("OPEN_MOM_BUY", reg);
        double primaryWr = adaptiveRankingService.winRate(sig, reg);

        String bestEntry = "EARLY";

        Double avgRr = averageRr();

        return ProbabilisticGuidanceDto.builder()
                .continuationProbability(contWr >= 0 ? contWr : null)
                .openingMomentumProbability(openWr >= 0 ? openWr : null)
                .bestRegime(reg.contains("CHOPPY") ? "TRENDING_BULL" : reg)
                .weakRegime("CHOPPY")
                .bestEntryQuality(bestEntry)
                .historicalRrAverage(avgRr)
                .signalType(sig)
                .build();
    }

    private Double averageRr() {
        LocalDate since = MarketTime.nowLocal().toLocalDate().minusDays(tradingProperties.getIntelligenceLookbackDays());
        List<SignalOutcome> outcomes = outcomeRepository.findAll().stream()
                .filter(o -> !o.getSessionDate().isBefore(since) && o.getRrAchieved() != null)
                .toList();
        if (outcomes.isEmpty()) return null;
        double avg = outcomes.stream().mapToDouble(SignalOutcome::getRrAchieved).average().orElse(0);
        return Math.round(avg * 10) / 10.0;
    }
}
