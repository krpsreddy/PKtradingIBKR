package com.tradingbot.dataintegrity.recovery;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Phase 212 — downtime → recovery strategy. */
@Component
public class RecoveryDowntimePolicy {

    public enum Strategy {
        /** <15 min — small IBKR backfill + continue. */
        BACKFILL_AND_CONTINUE,
        /** 15–60 min — partial rolling rebuild. */
        PARTIAL_REBUILD,
        /** >60 min same session — full lifecycle reset. */
        FULL_LIFECYCLE_RESET,
        /** Overnight / new session — bootstrap only. */
        FRESH_SESSION_BOOTSTRAP
    }

    @Value("${live.recovery.backfill-minutes:30}")
    private int backfillMinutes;

    @Value("${live.recovery.partial-rebuild-minutes:60}")
    private int partialRebuildMinutes;

    public Strategy resolve(long disconnectMinutes, boolean newSessionDay) {
        if (newSessionDay) {
            return Strategy.FRESH_SESSION_BOOTSTRAP;
        }
        if (disconnectMinutes < 15) {
            return Strategy.BACKFILL_AND_CONTINUE;
        }
        if (disconnectMinutes <= partialRebuildMinutes) {
            return Strategy.PARTIAL_REBUILD;
        }
        return Strategy.FULL_LIFECYCLE_RESET;
    }

    public int historicalDurationMinutes(Strategy strategy) {
        return switch (strategy) {
            case BACKFILL_AND_CONTINUE -> Math.min(30, backfillMinutes);
            case PARTIAL_REBUILD -> Math.min(60, partialRebuildMinutes);
            case FULL_LIFECYCLE_RESET, FRESH_SESSION_BOOTSTRAP -> partialRebuildMinutes;
        };
    }

    public boolean resetLifecycleState(Strategy strategy) {
        return strategy == Strategy.FULL_LIFECYCLE_RESET || strategy == Strategy.FRESH_SESSION_BOOTSTRAP;
    }
}
