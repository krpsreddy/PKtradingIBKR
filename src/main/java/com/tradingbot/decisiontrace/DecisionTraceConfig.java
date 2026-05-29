package com.tradingbot.decisiontrace;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/** Phase 201 — non-blocking append-only decision trace persistence. */
@Configuration
public class DecisionTraceConfig {

    @Bean(name = "decisionTraceExecutor")
    public Executor decisionTraceExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(1);
        ex.setMaxPoolSize(2);
        ex.setQueueCapacity(1000);
        ex.setThreadNamePrefix("decision-trace-");
        ex.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.DiscardOldestPolicy());
        ex.initialize();
        return ex;
    }
}
