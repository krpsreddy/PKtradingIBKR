package com.tradingbot.livetrader.execution;

import com.tradingbot.dataintegrity.ExecutionSafetyIntegrator;
import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.livetrader.LiveTraderRuntimeState;
import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionResearchService;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Phase 188 — execution safety gates + kill switch.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionSafetyService {

    private final LiveTraderRuntimeState runtimeState;
    private final IBKRClientService ibkrClientService;
    /** Lazy resolve — breaks cycle with {@link PaperExecutionResearchService}. */
    private final ObjectProvider<PaperExecutionResearchService> paperResearchServiceProvider;
    private final PaperExecutionRecordRepository paperRepository;
    private final ExecutionSafetyIntegrator dataIntegrityIntegrator;

    @Value("${live-trader.safety.max-daily-loss-r:3.0}")
    private double maxDailyLossR;

    @Value("${live-trader.safety.max-consecutive-losses:4}")
    private int maxConsecutiveLosses;

    @Value("${live-trader.safety.max-open-positions:3}")
    private int maxOpenPositions;

    @Value("${live-trader.safety.max-probes-per-hour:12}")
    private int maxProbesPerHour;

    private final AtomicInteger consecutiveLosses = new AtomicInteger(0);
    private final AtomicInteger probesThisHour = new AtomicInteger(0);
    private final AtomicReference<Instant> hourWindowStart = new AtomicReference<>(Instant.now());
    private final AtomicReference<LocalDate> lossDay = new AtomicReference<>(LocalDate.now(ZoneId.of("America/New_York")));
    private volatile double dailyRealizedR;

    public SafetyCheckResult checkAutoEntry() {
        if (runtimeState.isKillSwitchActive()) {
            return SafetyCheckResult.blocked("Kill switch active");
        }
        if (!ibkrClientService.isConnected()) {
            return SafetyCheckResult.blocked("IBKR disconnected");
        }
        if (!ibkrClientService.isReadyForOrders()) {
            return SafetyCheckResult.blocked("IBKR not ready");
        }
        PaperExecutionResearchService paperResearch = paperResearchServiceProvider.getIfAvailable();
        if (paperResearch != null && paperResearch.activeRecords().size() >= maxOpenPositions) {
            return SafetyCheckResult.blocked("Max open positions (" + maxOpenPositions + ")");
        }
        rollLossDay();
        if (dailyRealizedR <= -maxDailyLossR) {
            return SafetyCheckResult.blocked("Daily max loss reached");
        }
        if (consecutiveLosses.get() >= maxConsecutiveLosses) {
            return SafetyCheckResult.blocked("Max consecutive losses");
        }
        rollProbeHour();
        if (probesThisHour.get() >= maxProbesPerHour) {
            return SafetyCheckResult.blocked("Probe rate limit");
        }
        var dataBlock = dataIntegrityIntegrator.blockReason();
        if (dataBlock.isPresent()) {
            return SafetyCheckResult.blocked(dataBlock.get());
        }
        return SafetyCheckResult.ok();
    }

    public void recordProbeAttempt() {
        rollProbeHour();
        probesThisHour.incrementAndGet();
    }

    public void recordClosedTrade(BigDecimal realizedR) {
        rollLossDay();
        if (realizedR != null) {
            dailyRealizedR += realizedR.doubleValue();
            if (realizedR.doubleValue() < 0) {
                consecutiveLosses.incrementAndGet();
            } else {
                consecutiveLosses.set(0);
            }
        }
    }

    public LiveTraderDtos.KillSwitchResultDto activateKillSwitch() {
        log.warn("KILL SWITCH activated — halting scanner and execution");
        runtimeState.activateKillSwitch();
        int flattened = 0;
        try {
            PaperExecutionResearchService paperResearch = paperResearchServiceProvider.getIfAvailable();
            if (paperResearch != null) {
                for (var record : paperResearch.activeRecords()) {
                    paperResearch.markManualClose(record.getId(), null);
                    flattened++;
                }
            }
        } catch (Exception e) {
            log.error("Kill switch flatten error: {}", e.getMessage());
        }
        return new LiveTraderDtos.KillSwitchResultDto(true, flattened, "Emergency stop engaged");
    }

    public LiveTraderDtos.KillSwitchResultDto resetKillSwitch() {
        runtimeState.resetKillSwitch();
        return new LiveTraderDtos.KillSwitchResultDto(false, 0, "Kill switch cleared");
    }

    private void rollLossDay() {
        LocalDate today = LocalDate.now(ZoneId.of("America/New_York"));
        if (!today.equals(lossDay.get())) {
            lossDay.set(today);
            dailyRealizedR = 0;
            consecutiveLosses.set(0);
        }
    }

    private void rollProbeHour() {
        Instant start = hourWindowStart.get();
        if (Instant.now().isAfter(start.plusSeconds(3600))) {
            hourWindowStart.set(Instant.now());
            probesThisHour.set(0);
        }
    }

    public record SafetyCheckResult(boolean allowed, String reason) {
        static SafetyCheckResult ok() {
            return new SafetyCheckResult(true, null);
        }

        static SafetyCheckResult blocked(String reason) {
            return new SafetyCheckResult(false, reason);
        }
    }
}
