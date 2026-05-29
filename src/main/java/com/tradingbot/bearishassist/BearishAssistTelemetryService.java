package com.tradingbot.bearishassist;

import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.models.BearishAssistTelemetryRecord;
import com.tradingbot.repository.BearishAssistTelemetryRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.concurrent.Executor;

/** Phase 202 — async telemetry for PUT assist triggers (follow-through learning). */
@Service
public class BearishAssistTelemetryService {

    private final BearishAssistTelemetryRepository repository;
    private final Executor executor;

    public BearishAssistTelemetryService(
            BearishAssistTelemetryRepository repository,
            @Qualifier("decisionTraceExecutor") Executor executor
    ) {
        this.repository = repository;
        this.executor = executor;
    }

    public void recordTrigger(LiveTraderDtos.RankedOpportunityDto opp, PutAssistAssessment assessment) {
        executor.execute(() -> repository.save(BearishAssistTelemetryRecord.builder()
                .symbol(opp.symbol())
                .regime(opp.regime())
                .bearishBias(assessment.bearishBias())
                .bearishState(assessment.bearishState().name())
                .breakdownProbability(assessment.breakdownProbability().name())
                .confidence(assessment.confidence().name())
                .narrative(assessment.narrative())
                .reasons(String.join("|", assessment.reasons()))
                .build()));
    }
}
