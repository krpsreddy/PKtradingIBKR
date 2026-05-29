package com.tradingbot.paper;

import com.tradingbot.api.dto.PaperProbeRequest;
import com.tradingbot.config.PaperExecutionProperties;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.execution.paperintelligence.simulation.PaperExecutionIntelligenceCoordinator;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.livetrader.execution.ExecutionSafetyService;
import com.tradingbot.livetrader.execution.ExecutionTelemetryService;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import com.tradingbot.runtime.RuntimeProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PaperExecutionResearchService {

    private final PaperExecutionStateService stateService;
    private final PaperExecutionProperties properties;
    private final IbkrGatewaySafetyService safetyService;
    private final PaperOrderPlacementService orderPlacementService;
    private final PaperExecutionRecordRepository repository;
    private final PaperExecutionMetricsService metricsService;
    private final ExecutionTelemetryService telemetryService;
    private final ExecutionSafetyService executionSafetyService;
    private final PaperExecutionIntelligenceCoordinator paperIntelligence;
    private final RuntimeProfileService runtimeProfileService;

    @Transactional
    public PaperExecutionRecord submitProbe(PaperProbeRequest request) {
        return submitProbe(request, null);
    }

    @Transactional
    public PaperExecutionRecord submitProbe(PaperProbeRequest request, LiveTraderDtos.RankedOpportunityDto opp) {
        PaperExecutionMode mode = stateService.getMode();
        IbkrGatewaySafetyService.SafetyValidation safety = safetyService.validate(mode);
        String regime = normalizeRegime(request.regime());

        PaperExecutionRecord record = PaperExecutionRecord.builder()
                .symbol(request.symbol().toUpperCase(Locale.ROOT))
                .regime(regime)
                .executionMode(mode)
                .runtimeProfile(runtimeProfileService.getRuntimeType().name())
                .planSource(request.planSource())
                .entryPrice(request.entryPrice())
                .quantity(properties.getFixedQuantity())
                .orderType(properties.getOrderType())
                .convictionScore(request.convictionScore())
                .dominanceScore(request.dominanceScore())
                .executionQuality(request.executionQuality())
                .exitSuggestion("MANUAL EXIT — system tracks continuation only")
                .status(PaperExecutionStatus.PENDING)
                .build();

        if (!properties.isResearchEnabled()) {
            return saveBlocked(record, "Paper execution research disabled (use evolution profile)");
        }
        if (!safety.allowed()) {
            return saveBlocked(record, safety.reason());
        }
        if (mode != PaperExecutionMode.PAPER_RESEARCH) {
            return saveBlocked(record, "Execution mode is " + mode.name());
        }
        if (!isQualifiedRegime(regime)) {
            return saveBlocked(record, "Regime not qualified for research: " + regime);
        }
        if (isDeduped(record.getSymbol(), regime)) {
            return saveBlocked(record, "Duplicate probe within dedupe window");
        }

        record.setSubmittedAt(Instant.now());
        record.setStatus(PaperExecutionStatus.SUBMITTED);
        repository.save(record);

        if (paperIntelligence.isSimulatedFillsOnly() && opp != null) {
            return paperIntelligence.executeSimulatedEntry(record, opp, request.planSource());
        }

        if (paperIntelligence.isSimulatedFillsOnly()) {
            record.setStatus(PaperExecutionStatus.REJECTED);
            record.setBlockedReason("Simulated fills require ranked opportunity context");
            return repository.save(record);
        }

        PaperOrderPlacementService.PlacementResult placement = orderPlacementService.placeOneShareBuy(record);
        if (!placement.success()) {
            record.setStatus(PaperExecutionStatus.REJECTED);
            record.setBlockedReason(placement.error());
            return repository.save(record);
        }
        record.setIbkrOrderId(placement.orderId());
        record.setEntryLatencyMs(placement.latencyMs());
        record.setStatus(PaperExecutionStatus.SUBMITTED);
        return repository.save(record);
    }

    @Transactional
    public PaperExecutionRecord markAdaptiveClose(Long id, BigDecimal exitPrice, String exitReason) {
        PaperExecutionRecord record = markManualClose(id, exitPrice);
        if (exitReason != null && !exitReason.isBlank()) {
            record.setExitQualityNote(exitReason);
        }
        return repository.save(record);
    }

    @Transactional
    public PaperExecutionRecord markManualClose(Long id, BigDecimal exitPrice) {
        PaperExecutionRecord record = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Record not found: " + id));
        record.setStatus(PaperExecutionStatus.CLOSED);
        record.setClosedAt(Instant.now());
        if (exitPrice != null && record.getFillPrice() != null) {
            BigDecimal risk = record.getFillPrice();
            if (risk.compareTo(BigDecimal.ZERO) > 0) {
                record.setRealizedR(exitPrice.subtract(record.getFillPrice()).divide(risk, 4, java.math.RoundingMode.HALF_UP));
            }
        }
        metricsService.finalizeOnClose(record);
        String exitReason = record.getExitQualityNote() != null ? record.getExitQualityNote() : "MANUAL_CLOSE";
        if (paperIntelligence.isActive()) {
            paperIntelligence.finalizeExit(record, exitReason, null);
        } else {
            telemetryService.captureExit(record, exitReason);
        }
        if (record.getRealizedR() != null) {
            executionSafetyService.recordClosedTrade(record.getRealizedR());
        }
        return repository.save(record);
    }

    public List<PaperExecutionRecord> activeRecords() {
        return repository.findByStatusInOrderBySubmittedAtDesc(List.of(
                PaperExecutionStatus.SUBMITTED,
                PaperExecutionStatus.PARTIALLY_FILLED,
                PaperExecutionStatus.FILLED,
                PaperExecutionStatus.OPEN
        ));
    }

    public List<PaperExecutionRecord> history() {
        return repository.findAllByOrderBySubmittedAtDesc();
    }

    private PaperExecutionRecord saveBlocked(PaperExecutionRecord record, String reason) {
        record.setStatus(PaperExecutionStatus.BLOCKED);
        record.setBlockedReason(reason);
        return repository.save(record);
    }

    private boolean isQualifiedRegime(String regime) {
        if (regime == null) return false;
        String r = regime.toUpperCase(Locale.ROOT);
        if (properties.getBlockedRegimes().contains(r)) return false;
        return properties.getQualifiedRegimes().contains(r)
                || r.contains("PERSISTENCE")
                || r.contains("EXPANSION")
                || r.contains("PULLBACK")
                || r.contains("VWAP")
                || r.contains("COMPRESSION")
                || r.contains("EXTENSION");
    }

    private boolean isDeduped(String symbol, String regime) {
        Instant after = Instant.now().minus(properties.getDedupeMinutes(), ChronoUnit.MINUTES);
        return repository.findTopBySymbolAndRegimeAndSubmittedAtAfterOrderBySubmittedAtDesc(symbol, regime, after)
                .filter(r -> r.getStatus() != PaperExecutionStatus.BLOCKED)
                .isPresent();
    }

    private String normalizeRegime(String regime) {
        if (regime == null || regime.isBlank()) return "UNKNOWN";
        return regime.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }
}
