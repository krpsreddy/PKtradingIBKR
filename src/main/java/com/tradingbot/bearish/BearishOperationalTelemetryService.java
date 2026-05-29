package com.tradingbot.bearish;

import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.models.BearishOperationalTraceRecord;
import com.tradingbot.repository.BearishOperationalTraceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** Phase 209 — async persistence of bearish operational traces. */
@Service
@RequiredArgsConstructor
public class BearishOperationalTelemetryService {

    private final BearishOperationalTraceRepository repository;

    @Async("decisionTraceExecutor")
    @Transactional
    public void record(
            LiveTraderDtos.RankedOpportunityDto opp,
            BearishStructureSignals signals,
            LiveTraderDtos.BearishOperationalOverlayDto overlay,
            String narrative
    ) {
        repository.save(BearishOperationalTraceRecord.builder()
                .symbol(opp.symbol())
                .bearishRegime(signals.bearishRegime())
                .suppressionLevel(overlay.longSuppression())
                .deteriorationLevel(overlay.deterioration())
                .putGrade(overlay.putAssistGrade())
                .conflictLevel(overlay.directionalConflict())
                .environment(overlay.bearishEnvironment())
                .rejectionPersistence(signals.rejectionPersistence())
                .reclaimFailure(signals.reclaimFailureScore())
                .downsideRvol(signals.downsideRvol())
                .breakdownAcceleration(signals.breakdownAcceleration())
                .decisionNarrative(narrative != null && narrative.length() > 1000
                        ? narrative.substring(0, 1000) : narrative)
                .recordedAt(Instant.now())
                .build());
    }
}
