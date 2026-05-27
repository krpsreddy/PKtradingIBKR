package com.tradingbot.livetrader;

import com.tradingbot.intelligence.execution.realtime.dto.RealTimeExecutionDtos.ExecutionFeedItemDto;
import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerOpportunityDto;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class LiveTraderRankingService {

    public List<LiveTraderDtos.RankedOpportunityDto> rank(
            List<ExecutionFeedItemDto> feed,
            List<ScannerOpportunityDto> scanner
    ) {
        Map<String, LiveTraderDtos.RankedOpportunityDto> bySymbol = new LinkedHashMap<>();

        for (ExecutionFeedItemDto item : feed) {
            bySymbol.put(item.symbol(), fromFeed(item));
        }
        for (ScannerOpportunityDto card : scanner) {
            bySymbol.merge(card.symbol(), fromScanner(card), this::mergeRanked);
        }

        return bySymbol.values().stream()
                .sorted(Comparator.comparingInt(LiveTraderDtos.RankedOpportunityDto::dominanceScore).reversed())
                .limit(8)
                .collect(Collectors.toList());
    }

    public List<LiveTraderDtos.RankedOpportunityDto> degrading(List<LiveTraderDtos.RankedOpportunityDto> ranked) {
        return ranked.stream()
                .filter(LiveTraderDtos.RankedOpportunityDto::degrading)
                .limit(5)
                .collect(Collectors.toList());
    }

    private LiveTraderDtos.RankedOpportunityDto mergeRanked(
            LiveTraderDtos.RankedOpportunityDto a,
            LiveTraderDtos.RankedOpportunityDto b
    ) {
        if (b.dominanceScore() > a.dominanceScore()) return b;
        return a;
    }

    private LiveTraderDtos.RankedOpportunityDto fromFeed(ExecutionFeedItemDto item) {
        int dominance = item.conviction()
                + (int) (item.triggerIntegrity() * 20)
                + Math.min(30, item.persistenceSeconds() / 10)
                + item.convictionVelocity() * 2;
        return new LiveTraderDtos.RankedOpportunityDto(
                item.symbol(),
                item.opportunityType(),
                item.action(),
                item.tone(),
                item.badge(),
                item.maturityState(),
                item.conviction(),
                item.convictionVelocity(),
                item.persistenceSeconds(),
                (int) (item.triggerIntegrity() * 100),
                item.expansionProbability(),
                dominance,
                item.whyNow(),
                item.entryZoneLabel(),
                item.riskLabel(),
                item.convictionVelocity() > 3 && item.conviction() >= 65,
                isDegrading(item.maturityState(), item.opportunityType()),
                item.updatedAt()
        );
    }

    private LiveTraderDtos.RankedOpportunityDto fromScanner(ScannerOpportunityDto card) {
        int dominance = card.convictionScore()
                + card.institutionalPressure() / 2
                + card.continuationPersistence() / 3
                + card.triggerIntegrity() / 2;
        return new LiveTraderDtos.RankedOpportunityDto(
                card.symbol(),
                card.opportunityType(),
                card.action(),
                card.tone(),
                card.badge(),
                "CONFIRMED",
                card.convictionScore(),
                0,
                card.continuationPersistence(),
                card.institutionalPressure(),
                card.expansionProbability(),
                dominance,
                card.whyNow(),
                card.entryZoneLabel(),
                card.riskLabel(),
                card.expansionProbability() > 60,
                card.exhaustionProbability() > 55 || card.tone().equals("RED"),
                System.currentTimeMillis()
        );
    }

    private boolean isDegrading(String maturity, String regime) {
        if (maturity != null && (maturity.contains("EXHAUST") || maturity.contains("FAILED"))) return true;
        return regime != null && regime.toUpperCase().contains("EXHAUSTION");
    }
}
