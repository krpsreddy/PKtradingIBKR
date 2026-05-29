package com.tradingbot.ibkr.stream;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "ibkr.stream")
public class LiveStreamProperties {

    /** When true, replaces static subscribeLive batch with dynamic allocation. */
    private boolean dynamicEnabled = true;

    /** Dominance score floor for full realtime (LiveSymbolScanState). */
    private int dominanceRealtimeThreshold = 130;

    /** Scanner top-N always considered for realtime slots. */
    private int scannerTopRealtimeSlots = 8;

    /** Max symbols in light snapshot refresh (no reqMktData). */
    private int maxSnapshotSymbols = 30;

    /** Snapshot refresh interval (seconds). */
    private int snapshotIntervalSec = 30;

    /** Minutes without scanner relevance before DORMANT. */
    private int inactiveDormantMinutes = 45;

    /** Orchestrator reconcile interval (ms). */
    private long reconcileIntervalMs = 30_000;

    /** Phase 216 — first tick must arrive within this window after reqMktData. */
    private int verifyTimeoutSeconds = 10;

    private int staleSeconds = 60;

    private int deadSeconds = 120;

    private boolean autoRecover = true;
}
