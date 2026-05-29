package com.tradingbot.dataintegrity;

import com.tradingbot.dataintegrity.integrity.RuntimeIntegrityState;
import com.tradingbot.dataintegrity.recovery.GapRecoveryService;
import com.tradingbot.replay.ReplayRuntimeMode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** Phase 212 — gates execution paths on trusted data. */
@Component
@RequiredArgsConstructor
public class ExecutionSafetyIntegrator {

    private final DataIntegrityEngine integrityEngine;
    private final ReplayRuntimeMode replayRuntimeMode;
    private final GapRecoveryService gapRecoveryService;

    public boolean allowsExecution() {
        if (replayRuntimeMode.isReplayActive()) {
            return true;
        }
        if (gapRecoveryService.recoveryInProgress()) {
            return false;
        }
        DataIntegritySnapshot snap = integrityEngine.current();
        return snap.allowsExecution() && snap.state() != RuntimeIntegrityState.RECOVERING;
    }

    public boolean freezeRegimeMutation() {
        if (replayRuntimeMode.isReplayActive()) {
            return false;
        }
        return integrityEngine.current().freezeRegimeMutation();
    }

    public boolean blocksAdaptiveExits() {
        return blocksRecoverySensitiveOps();
    }

    public boolean blocksLifecycleTransitions() {
        return blocksRecoverySensitiveOps();
    }

    public boolean blocksQueuePromotion() {
        return blocksRecoverySensitiveOps();
    }

    public boolean blocksRecoverySensitiveOps() {
        if (replayRuntimeMode.isReplayActive()) {
            return false;
        }
        if (gapRecoveryService.recoveryInProgress()) {
            return true;
        }
        RuntimeIntegrityState state = integrityEngine.current().state();
        return state.blocksRecoverySensitiveOps();
    }

    public Optional<String> blockReason() {
        if (replayRuntimeMode.isReplayActive()) {
            return Optional.empty();
        }
        DataIntegritySnapshot snap = integrityEngine.current();
        if (gapRecoveryService.recoveryInProgress()) {
            return Optional.of("Data recovery in progress");
        }
        if (!allowsExecution()) {
            return Optional.of("Data integrity " + snap.state() + " (score " + snap.score() + ")");
        }
        return Optional.empty();
    }

    public DataIntegritySnapshot snapshot() {
        if (replayRuntimeMode.isReplayActive()) {
            return DataIntegrityEngine.liveBypassSnapshot();
        }
        return integrityEngine.current();
    }

    public double dominanceMultiplier() {
        return snapshot().dominanceMultiplier();
    }

    public double convictionMultiplier() {
        return snapshot().convictionMultiplier();
    }

    public double persistenceMultiplier() {
        return snapshot().persistenceMultiplier();
    }

    public String integrityBadge() {
        return snapshot().state().name();
    }
}
