package com.tradingbot.ai.provider;

import com.tradingbot.ai.dto.AiDtos.AiExecutionResponseDto;
import com.tradingbot.config.AiProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Future OpenAI provider — configured but not wired for realtime hot path by default.
 * Enable via ai.openai.enabled=true and ai.provider=openai.
 */
@Slf4j
@Component
public class OpenAiProvider extends AbstractGenerateAiProvider {

    private final AiProperties properties;
    private final RestTemplate restTemplate;

    public OpenAiProvider(AiProperties properties, RestTemplateBuilder builder) {
        this.properties = properties;
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofMillis(properties.getOpenai().getTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(properties.getOpenai().getTimeoutMs()))
                .build();
    }

    @Override
    public String id() {
        return "openai";
    }

    @Override
    public boolean isAvailable() {
        if (!properties.isEnabled() || !properties.getOpenai().isEnabled()) return false;
        String key = properties.getOpenai().getApiKey();
        return key != null && !key.isBlank();
    }

    @Override
    protected String generate(String prompt) {
        if (!isAvailable()) {
            throw new IllegalStateException("OpenAI provider not enabled or missing API key");
        }
        String url = properties.getOpenai().getBaseUrl() + "/chat/completions";
        Map<String, Object> body = Map.of(
                "model", properties.getOpenai().getModel(),
                "max_tokens", properties.getOpenai().getMaxTokens(),
                "temperature", 0.2,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                )
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(properties.getOpenai().getApiKey());
        ResponseEntity<Map> resp = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        if (resp.getBody() == null) return "";
        Object choices = resp.getBody().get("choices");
        if (choices instanceof List<?> list && !list.isEmpty()) {
            Object first = list.get(0);
            if (first instanceof Map<?, ?> choice) {
                Object message = choice.get("message");
                if (message instanceof Map<?, ?> msg) {
                    Object content = msg.get("content");
                    return content != null ? content.toString() : "";
                }
            }
        }
        return "";
    }
}
