package com.tradingbot.livetrader.execution;

import com.tradingbot.intelligence.live.MarketSessionClock;
import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.models.ExecutionTelemetryRecord;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.repository.ExecutionTelemetryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ExecutionTelemetryService {

    private final ExecutionTelemetryRepository repository;
    private final MarketSessionClock sessionClock;

    @Transactional
    public ExecutionTelemetryRecord captureEntry(
            PaperExecutionRecord paper,
            LiveTraderDtos.RankedOpportunityDto opp,
            String entryReason
    ) {
        ExecutionTelemetryRecord t = ExecutionTelemetryRecord.builder()
                .paperExecutionId(paper.getId())
                .symbol(paper.getSymbol())
                .regime(paper.getRegime())
                .openedAt(Instant.now())
                .conviction(opp.conviction())
                .dominance(opp.dominanceScore())
                .persistence(opp.persistenceSeconds())
                .rvol(BigDecimal.valueOf(opp.rvol()).setScale(3, RoundingMode.HALF_UP))
                .velocity(opp.convictionVelocity())
                .lifecycle(opp.tradeLifecycle())
                .executionQuality(opp.executionQuality())
                .entryReason(entryReason)
                .entryPrice(paper.getEntryPrice() != null ? paper.getEntryPrice() : paper.getFillPrice())
                .stopPrice(parsePrice(opp.stopLabel()))
                .targetPrice(parsePrice(opp.targetLabel()))
                .marketRegime(opp.regime())
                .sessionPeriod(sessionClock.windowLabel(sessionClock.sessionMinutesSinceRthOpen()))
                .build();
        return repository.save(t);
    }

    @Transactional
    public void updateMfeMae(Long paperExecutionId, BigDecimal mfeR, BigDecimal maeR) {
        repository.findByPaperExecutionId(paperExecutionId).ifPresent(t -> {
            if (mfeR != null) t.setMfeR(mfeR);
            if (maeR != null) t.setMaeR(maeR);
            repository.save(t);
        });
    }

    @Transactional
    public void captureExit(PaperExecutionRecord paper, String exitReason) {
        repository.findByPaperExecutionId(paper.getId()).ifPresent(t -> {
            t.setClosedAt(paper.getClosedAt() != null ? paper.getClosedAt() : Instant.now());
            t.setExitReason(exitReason);
            t.setRealizedR(paper.getRealizedR());
            t.setMfeR(paper.getMfeR());
            t.setMaeR(paper.getMaeR());
            if (t.getOpenedAt() != null && t.getClosedAt() != null) {
                t.setHoldDurationSec((int) Duration.between(t.getOpenedAt(), t.getClosedAt()).toSeconds());
            }
            repository.save(t);
        });
    }

    public List<LiveTraderDtos.TelemetryLogDto> recentLogs(int limit) {
        return repository.findTop50ByOrderByOpenedAtDesc().stream()
                .limit(limit)
                .map(t -> new LiveTraderDtos.TelemetryLogDto(
                        t.getSymbol(),
                        t.getRegime(),
                        t.getExecutionQuality(),
                        t.getEntryReason(),
                        t.getExitReason(),
                        t.getRealizedR() != null ? t.getRealizedR().doubleValue() : null,
                        t.getOpenedAt() != null ? t.getOpenedAt().toEpochMilli() : 0
                ))
                .toList();
    }

    private static BigDecimal parsePrice(String label) {
        if (label == null || label.isBlank() || label.equals("—")) return null;
        try {
            String n = label.replaceAll("[^0-9.]", "");
            if (n.isBlank()) return null;
            return new BigDecimal(n);
        } catch (Exception e) {
            return null;
        }
    }
}
