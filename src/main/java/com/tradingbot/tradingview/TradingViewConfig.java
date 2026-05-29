package com.tradingbot.tradingview;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(TradingViewProperties.class)
public class TradingViewConfig {
}
