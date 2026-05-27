package com.tradingbot.paper;

import com.tradingbot.ibkr.IBKRClientService;
import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.repository.PaperExecutionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** Lightweight MFE/MAE tracking for open paper positions (event-driven tick poll). */
@Service
@RequiredArgsConstructor
public class PaperExecutionMetricsService {

    private final PaperExecutionRecordRepository repository;
    private final IBKRClientService ibkrClientService;

    @Scheduled(fixedDelayString = "${paper-execution.metrics-poll-ms:5000}", initialDelay = 10_000)
    @Transactional
    public void refreshOpenMetrics() {
        List<PaperExecutionRecord> open = repository.findByStatusInOrderBySubmittedAtDesc(List.of(
                PaperExecutionStatus.FILLED,
                PaperExecutionStatus.OPEN,
                PaperExecutionStatus.SUBMITTED
        ));
        for (PaperExecutionRecord record : open) {
            Double last = ibkrClientService.getLastPrice(record.getSymbol());
            if (last == null || record.getFillPrice() == null) continue;
            updateMfeMae(record, BigDecimal.valueOf(last));
            repository.save(record);
        }
    }

    void updateMfeMae(PaperExecutionRecord record, BigDecimal price) {
        BigDecimal entry = record.getFillPrice() != null ? record.getFillPrice() : record.getEntryPrice();
        if (entry == null || entry.compareTo(BigDecimal.ZERO) == 0) return;
        BigDecimal moveR = price.subtract(entry).divide(entry, 6, RoundingMode.HALF_UP);
        if (record.getMfeR() == null || moveR.compareTo(record.getMfeR()) > 0) {
            record.setMfeR(moveR);
        }
        if (record.getMaeR() == null || moveR.compareTo(record.getMaeR()) < 0) {
            record.setMaeR(moveR);
        }
        if (record.getStatus() == PaperExecutionStatus.SUBMITTED && record.getFillPrice() != null) {
            record.setStatus(PaperExecutionStatus.OPEN);
        }
    }

    void finalizeOnClose(PaperExecutionRecord record) {
        if (record.getMfeR() != null && record.getMfeR().compareTo(BigDecimal.ZERO) > 0) {
            record.setContinuationSurvival(true);
        }
    }

    public void onOrderFilled(int orderId, double avgFillPrice) {
        repository.findByIbkrOrderId(orderId).ifPresent(record -> {
                    record.setFillPrice(BigDecimal.valueOf(avgFillPrice));
                    record.setStatus(PaperExecutionStatus.FILLED);
                    if (record.getEntryPrice() != null) {
                        record.setSlippage(BigDecimal.valueOf(avgFillPrice).subtract(record.getEntryPrice()));
                    }
                    if (record.getSubmittedAt() != null) {
                        record.setFilledAt(java.time.Instant.now());
                    }
                    record.setStatus(PaperExecutionStatus.OPEN);
                    repository.save(record);
        });
    }
}
