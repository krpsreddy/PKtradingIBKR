package com.tradingbot.dataintegrity.recovery;

import com.tradingbot.dataintegrity.DataIntegrityEngine;
import com.tradingbot.replay.ReplayRuntimeMode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/** Phase 212 — reconnect → backfill → stabilize → LIVE. */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReconnectRecoveryCoordinator {

    private final DataIntegrityEngine integrityEngine;
    private final GapRecoveryService gapRecoveryService;
    private final ReplayRuntimeMode replayRuntimeMode;

    public void onBrokerDisconnected() {
        if (replayRuntimeMode.isReplayActive()) return;
        integrityEngine.onDisconnected();
    }

    public void onBrokerReady() {
        if (replayRuntimeMode.isReplayActive()) return;
        int bars = gapRecoveryService.stabilizationCandlesRequired();
        integrityEngine.onRecoveryStarted(bars);
        gapRecoveryService.backfillAndRebuild(() ->
                log.info("Reconnect recovery backfill complete; awaiting {} stabilization candles", bars));
    }
}
