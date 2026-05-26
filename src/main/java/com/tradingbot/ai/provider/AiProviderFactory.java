package com.tradingbot.ai.provider;

import com.tradingbot.config.AiProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Swappable provider selection — business logic never branches on vendor.
 */
@Component
@RequiredArgsConstructor
public class AiProviderFactory {

    private final AiProperties properties;
    private final OllamaAiProvider ollama;
    private final OpenAiProvider openAi;
    private final NoOpAiProvider noOp;

    public AbstractGenerateAiProvider resolve() {
        if (!properties.isEnabled()) {
            return noOp;
        }
        return switch (properties.getProvider().toLowerCase()) {
            case "ollama" -> ollama.isAvailable() ? ollama : noOp;
            case "openai" -> openAi.isAvailable() ? openAi : noOp;
            default -> noOp;
        };
    }

    public AbstractGenerateAiProvider configured() {
        return switch (properties.getProvider().toLowerCase()) {
            case "ollama" -> ollama;
            case "openai" -> openAi;
            default -> noOp;
        };
    }

    public NoOpAiProvider fallback() {
        return noOp;
    }
}
