package com.tradingbot.dataintegrity;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/** Phase 205 — async gap recovery executor. */
@Configuration
@EnableAsync
public class DataIntegrityConfig {

    @Bean(name = "dataIntegrityExecutor")
    public Executor dataIntegrityExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(1);
        ex.setMaxPoolSize(2);
        ex.setQueueCapacity(8);
        ex.setThreadNamePrefix("data-integrity-");
        ex.initialize();
        return ex;
    }
}
