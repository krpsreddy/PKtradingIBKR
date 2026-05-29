package com.tradingbot.sessionintelligence.telemetry;

import com.tradingbot.intelligence.live.MarketSessionClock;
import com.tradingbot.models.PremarketIntelligenceSnapshotRecord;
import com.tradingbot.repository.PremarketIntelligenceSnapshotRepository;
import com.tradingbot.sessionintelligence.premarket.PremarketSnapshotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PremarketIntelligenceTelemetryService {

    private final PremarketIntelligenceSnapshotRepository repository;
    private final MarketSessionClock sessionClock;

    @Async("decisionTraceExecutor")
    @Transactional
    public void recordAsync(PremarketSnapshotDto snap, String openTransitionOutcome) {
        repository.save(PremarketIntelligenceSnapshotRecord.builder()
                .symbol(snap.symbol())
                .sessionDate(sessionClock.sessionDayKey())
                .trendState(snap.trendState().name())
                .gapPct(snap.premarketGapPct())
                .qualityScore(snap.premarketQualityScore())
                .persistence(snap.premarketPersistence())
                .openingContinuationProb(snap.openingContinuationProbability())
                .pmStructure(snap.trendState().name() + " · " + snap.premarketBreakoutState())
                .openTransitionOutcome(openTransitionOutcome)
                .recordedAt(Instant.now())
                .build());
    }
}
