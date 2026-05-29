package com.tradingbot.dataintegrity.telemetry;

import com.tradingbot.dataintegrity.DataIntegritySnapshot;
import com.tradingbot.dataintegrity.integrity.IntegrityStateManager;
import com.tradingbot.dataintegrity.integrity.RuntimeIntegrityState;
import com.tradingbot.models.DataIntegrityTelemetryRecord;
import com.tradingbot.repository.DataIntegrityTelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** Phase 212 — persist integrity_event telemetry (append-only). */
@Service
@RequiredArgsConstructor
public class DataIntegrityTelemetryService {

    private final DataIntegrityTelemetryRepository repository;
    private final IntegrityStateManager stateManager;

    @Async("dataIntegrityExecutor")
    @Transactional
    public void record(String eventType, String detail) {
        DataIntegritySnapshot snap = stateManager.lastSnapshot();
        repository.save(DataIntegrityTelemetryRecord.builder()
                .eventType(eventType)
                .detail(detail != null && detail.length() > 500 ? detail.substring(0, 500) : detail)
                .integrityState(snap != null ? snap.state().name() : RuntimeIntegrityState.DISCONNECTED.name())
                .integrityScore(snap != null ? snap.score() : 0)
                .recordedAt(Instant.now())
                .build());
    }
}
