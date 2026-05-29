package com.tradingbot.tradingview.bridge;

import com.tradingbot.tradingview.dto.TradingViewFeedDto;
import com.tradingbot.tradingview.ranking.TradingViewRankingEngine;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Phase 217 — operational TV feed for PK Live Trader (secondary intelligence). */
@RestController
@RequestMapping("/api/tradingview")
@RequiredArgsConstructor
public class TradingViewFeedController {

    private final TradingViewRankingEngine rankingEngine;

    @GetMapping("/feed")
    public TradingViewFeedDto feed() {
        return rankingEngine.buildFeed();
    }
}
