package com.tradingbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "ai")
public class AiProperties {
    private boolean enabled = true;
    /** Active provider: ollama | openai | noop */
    private String provider = "ollama";
    private int cacheTtlMs = 12_000;

    private final Ollama ollama = new Ollama();
    private final OpenAi openai = new OpenAi();
    private final Safety safety = new Safety();

    @Data
    public static class Ollama {
        private String baseUrl = "http://localhost:11434";
        private String model = "qwen2.5:7b";
        private int timeoutMs = 8_000;
        private int maxTokens = 512;
    }

    @Data
    public static class OpenAi {
        private boolean enabled = false;
        private String apiKey = "";
        private String baseUrl = "https://api.openai.com/v1";
        private String model = "gpt-5-nano";
        private int timeoutMs = 12_000;
        private int maxTokens = 512;
    }

    @Data
    public static class Safety {
        private boolean enforceStopRespect = true;
        private boolean blockTradeOrders = true;
    }
}
