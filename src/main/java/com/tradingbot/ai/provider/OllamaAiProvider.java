package com.tradingbot.ai.provider;

import com.tradingbot.ai.dto.AiDtos.*;
import com.tradingbot.config.AiProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Component
public class OllamaAiProvider extends AbstractGenerateAiProvider {

    private final AiProperties properties;
    private final RestTemplate restTemplate;

    public OllamaAiProvider(AiProperties properties, RestTemplateBuilder builder) {
        this.properties = properties;
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofMillis(properties.getOllama().getTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(properties.getOllama().getTimeoutMs()))
                .build();
    }

    @Override
    public String id() {
        return "ollama";
    }

    @Override
    public boolean isAvailable() {
        if (!properties.isEnabled()) return false;
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(
                    properties.getOllama().getBaseUrl() + "/api/tags", String.class);
            return resp.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.debug("Ollama unavailable: {}", e.getMessage());
            return false;
        }
    }

    @Override
    protected String generate(String prompt) {
        String url = properties.getOllama().getBaseUrl() + "/api/generate";
        Map<String, Object> body = Map.of(
                "model", properties.getOllama().getModel(),
                "prompt", prompt,
                "stream", false,
                "options", Map.of("num_predict", properties.getOllama().getMaxTokens())
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> resp = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        if (resp.getBody() == null) return "";
        Object response = resp.getBody().get("response");
        return response != null ? response.toString() : "";
    }
}
