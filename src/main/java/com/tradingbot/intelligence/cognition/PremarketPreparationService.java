package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.DashboardService;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.OpeningMomentumDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.PremarketBriefDto;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PremarketPreparationService {

    private final DashboardService dashboardService;
    private final MarketHoursService marketHoursService;

    public PremarketBriefDto brief(MarketTrendDto trend) {
        boolean active = !marketHoursService.isMarketOpen();

        List<OpeningMomentumDto> opening = dashboardService.getOpeningMomentum();
        List<String> movers = opening.stream()
                .filter(o -> o.getGapPercent() != null && Math.abs(o.getGapPercent()) >= 2)
                .sorted(Comparator.comparing(OpeningMomentumDto::getGapPercent,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(o -> o.getSymbol() + " " + formatGap(o.getGapPercent()))
                .limit(8)
                .toList();

        List<String> highGap = opening.stream()
                .filter(o -> o.getGapPercent() != null && Math.abs(o.getGapPercent()) >= 4)
                .map(OpeningMomentumDto::getSymbol)
                .limit(6)
                .toList();

        List<String> momentum = opening.stream()
                .filter(o -> o.getRankScore() != null && o.getRankScore() >= 60)
                .map(OpeningMomentumDto::getSymbol)
                .limit(6)
                .toList();

        List<String> sectors = new ArrayList<>();
        if (trend != null) {
            if ("STRONG".equals(trend.getSemiBreadth())) sectors.add("Semiconductors");
            if ("STRONG".equals(trend.getAiBreadth())) sectors.add("AI/Tech");
            if (trend.isRiskOn()) sectors.add("Risk-on leaders");
        }

        List<String> notes = new ArrayList<>();
        if (trend != null) {
            notes.add("Likely opening regime: " + (trend.getRegime() != null ? trend.getRegime() : "TBD"));
            if (trend.isChoppy()) notes.add("Expect choppy open — wait for ORB confirmation");
        }
        LocalTime now = MarketTime.nowLocal().toLocalTime();
        if (now.isBefore(LocalTime.of(9, 30))) {
            notes.add("Pre-market: focus on gap + RVOL leaders");
        }

        return PremarketBriefDto.builder()
                .active(active)
                .likelyRegime(trend != null ? trend.getRegime() : null)
                .overnightMovers(movers)
                .highGapNames(highGap)
                .strongestSectors(sectors)
                .likelyMomentumSymbols(momentum)
                .notes(notes)
                .build();
    }

    private String formatGap(Double gap) {
        if (gap == null) return "";
        return (gap >= 0 ? "+" : "") + String.format("%.1f%%", gap);
    }
}
