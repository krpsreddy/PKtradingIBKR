package com.tradingbot.execution.paperintelligence.quality;

import com.tradingbot.execution.paperintelligence.entry.EntryExecutionPlan;
import com.tradingbot.models.PaperExecutionRecord;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

@Component
public class OrderTimeoutEngine {

    public record TimeoutCheck(boolean expired, String reason) {}

    public TimeoutCheck evaluatePending(PaperExecutionRecord record, EntryExecutionPlan plan) {
        if (record.getSubmittedAt() == null || plan == null) {
            return new TimeoutCheck(false, null);
        }
        long ageSec = Duration.between(record.getSubmittedAt(), Instant.now()).getSeconds();
        if (ageSec > plan.staleAfterSeconds()) {
            return new TimeoutCheck(true, "Order stale after " + ageSec + "s (max " + plan.staleAfterSeconds() + ")");
        }
        return new TimeoutCheck(false, null);
    }
}
