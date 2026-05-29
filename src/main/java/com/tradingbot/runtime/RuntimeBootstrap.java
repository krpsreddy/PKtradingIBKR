package com.tradingbot.runtime;

import com.tradingbot.livetrader.LiveTraderDtos;
import com.tradingbot.livetrader.LiveTraderRuntimeState;
import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@EnableConfigurationProperties({RuntimeProfileProperties.class, LiveTraderRuntimeProperties.class})
public class RuntimeBootstrap {

    private final RuntimeProfileService runtimeProfile;
    private final RuntimeExecutionSafetyGuard safetyGuard;
    private final LiveTraderRuntimeState runtimeState;
    private final PaperExecutionStateService paperExecutionState;

    @EventListener(ApplicationReadyEvent.class)
    void onReady() {
        safetyGuard.enforceOnStartup();
        applyConfiguredExecution();
        logStartupBanner();
    }

    private void applyConfiguredExecution() {
        if (runtimeProfile.isPaperRuntime() && runtimeProfile.allowsAutoPaper()) {
            paperExecutionState.setMode(PaperExecutionMode.PAPER_RESEARCH);
            runtimeState.apply(new LiveTraderDtos.SetRuntimeControlsRequest(
                    true,
                    null,
                    true,
                    PaperExecutionMode.PAPER_RESEARCH,
                    null,
                    null
            ));
            return;
        }
        paperExecutionState.setMode(PaperExecutionMode.OFF);
        runtimeState.apply(new LiveTraderDtos.SetRuntimeControlsRequest(
                true,
                null,
                false,
                PaperExecutionMode.OFF,
                null,
                null
        ));
    }

    private void logStartupBanner() {
        var p = runtimeProfile.snapshot();
        log.info(
                """
                [RUNTIME]
                profile={}
                port={}
                ibkrPort={}
                execution={}
                integrity={}
                autoPaper={}
                liveExecution={}
                """,
                p.runtime(),
                p.port(),
                p.ibkrPort(),
                p.executionMode(),
                p.integrityMode(),
                p.autoPaperEnabled(),
                p.liveExecutionEnabled()
        );
    }
}
