package com.tradingbot.discovery.historical;

import java.util.Locale;

/** Phase 204/206 — directional family mapping. */
public final class RegimeFamilyMapper {

    private RegimeFamilyMapper() {}

    public static String familyFor(String regime, String setup) {
        return familyFor(DiscoveryDirection.BULLISH, regime, setup);
    }

    public static String familyFor(DiscoveryDirection direction, String regime, String setup) {
        return direction == DiscoveryDirection.BEARISH
                ? BearishRegimeFamilyMapper.familyFor(regime, setup)
                : BullishRegimeFamilyMapper.familyFor(regime, setup);
    }
}
