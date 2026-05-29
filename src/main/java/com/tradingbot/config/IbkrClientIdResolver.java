package com.tradingbot.config;

import lombok.extern.slf4j.Slf4j;

/** Resolves effective IBKR API client id for this JVM (optional PID offset). */
@Slf4j
public final class IbkrClientIdResolver {

    private static final int PID_OFFSET_MOD = 50;

    private IbkrClientIdResolver() {
    }

    public static int baseClientId(IBKRProperties properties) {
        int base = properties.getClientId();
        if (!properties.isClientIdAutoOffset()) {
            return base;
        }
        int offset = (int) (ProcessHandle.current().pid() % PID_OFFSET_MOD);
        int effective = base + offset;
        log.info(
                "IBKR clientId auto-offset enabled: ibkr.clientId={} + pid%{}={} → effective base {}",
                base, PID_OFFSET_MOD, offset, effective
        );
        return effective;
    }
}
