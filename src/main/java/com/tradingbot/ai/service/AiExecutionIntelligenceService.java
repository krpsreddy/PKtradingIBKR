package com.tradingbot.ai.service;

import com.tradingbot.ai.dto.AiDtos.AiExecutionRequestDto;
import com.tradingbot.ai.dto.AiDtos.AiExecutionResponseDto;
import com.tradingbot.ai.prompt.AiPromptBuilderService;
import com.tradingbot.ai.provider.AbstractGenerateAiProvider;
import com.tradingbot.ai.provider.AiProviderFactory;
import com.tradingbot.ai.provider.NoOpAiProvider;
import com.tradingbot.config.AiProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AiExecutionIntelligenceService {

    private final AiProviderFactory providerFactory;
    private final AiPromptBuilderService promptBuilder;
    private final AiExecutionSnapshotBuilder snapshotBuilder;
    private final AiResponseValidator validator;
    private final AiProperties properties;
    private final NoOpAiProvider noOp;

    private final ConcurrentHashMap<String, CachedExecution> cache = new ConcurrentHashMap<>();

    public AiExecutionResponseDto analyze(String symbol, String signalType) {
        String key = symbol.toUpperCase() + "|" + (signalType != null ? signalType : "");
        CachedExecution hit = cache.get(key);
        if (hit != null && System.currentTimeMillis() - hit.ts < properties.getCacheTtlMs()) {
            return hit.response;
        }

        AiExecutionRequestDto request = snapshotBuilder.build(symbol, signalType);
        String prompt = promptBuilder.buildExecutionPrompt(request);
        AbstractGenerateAiProvider provider = providerFactory.resolve();

        AiExecutionResponseDto raw = provider instanceof NoOpAiProvider
                ? noOp.analyzeFromDeterministic(request)
                : provider.analyzeExecutionWithPrompt(prompt);

        if (!raw.isAvailable()) {
            raw = noOp.analyzeFromDeterministic(request);
        }

        AiExecutionResponseDto validated = validator.validateExecution(raw);
        cache.put(key, new CachedExecution(validated, System.currentTimeMillis()));
        return validated;
    }

    private record CachedExecution(AiExecutionResponseDto response, long ts) {}
}
