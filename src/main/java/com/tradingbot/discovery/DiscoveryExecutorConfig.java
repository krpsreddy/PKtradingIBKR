package com.tradingbot.discovery;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/** Phase 204 — async discovery workloads (isolated from live trading). */
@Configuration
@EnableAsync
public class DiscoveryExecutorConfig {

    @Bean(name = "discoveryExecutor")
    public Executor discoveryExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(1);
        ex.setMaxPoolSize(2);
        ex.setQueueCapacity(4);
        ex.setThreadNamePrefix("discovery-");
        ex.initialize();
        return ex;
    }
}
