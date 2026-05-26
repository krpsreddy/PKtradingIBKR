package com.tradingbot.ai.provider;

import com.tradingbot.ai.dto.AiDtos.*;

/** Provider contract — swappable via {@link AiProviderFactory}. */
public interface AiProvider {
    String id();
    boolean isAvailable();
}
