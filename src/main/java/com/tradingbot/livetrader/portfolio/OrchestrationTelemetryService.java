package com.tradingbot.livetrader.portfolio;

import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.models.OrchestrationTelemetryRecord;
import com.tradingbot.repository.OrchestrationTelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrchestrationTelemetryService {

    private final OrchestrationTelemetryRepository repository;

    public void record(LiveTraderDtos.RankedOpportunityDto opp, PortfolioDecision decision, String activeSymbol) {
        repository.save(OrchestrationTelemetryRecord.builder()
                .symbol(opp.symbol())
                .regime(opp.regime())
                .orchestrationState(decision.state().name())
                .reason(decision.reason())
                .conviction(opp.conviction())
                .dominance(opp.dominanceScore())
                .persistence(opp.persistenceSeconds())
                .activeSymbol(activeSymbol)
                .replacementAdvisory(decision.replacementAdvisory())
                .executed(decision.eligibleForExecution())
                .build());
    }
}
