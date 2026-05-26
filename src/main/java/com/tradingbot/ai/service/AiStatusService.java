package com.tradingbot.ai.service;

import com.tradingbot.ai.dto.AiDtos.AiProviderStatusDto;
import com.tradingbot.ai.provider.AiProviderFactory;
import com.tradingbot.config.AiProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiStatusService {

    private final AiProviderFactory providerFactory;
    private final AiProperties properties;

    public AiProviderStatusDto status() {
        var configured = providerFactory.configured();
        var active = providerFactory.resolve();
        String model = switch (active.id()) {
            case "ollama" -> properties.getOllama().getModel();
            case "openai" -> properties.getOpenai().getModel();
            default -> "deterministic-fallback";
        };
        String message = active.id().equals(configured.id())
                ? "AI provider active"
                : configured.id() + " unavailable — " + active.id() + " fallback";
        return AiProviderStatusDto.builder()
                .enabled(properties.isEnabled())
                .configuredProvider(properties.getProvider())
                .activeProvider(active.id())
                .providerAvailable(configured.isAvailable())
                .model(model)
                .message(message)
                .build();
    }
}
