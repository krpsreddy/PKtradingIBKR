package com.tradingbot.tradingview.bridge;

import com.tradingbot.tradingview.dto.PineDiscoveryExportDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Phase 217 — discovery → Pine intelligence export. */
@RestController
@RequestMapping("/api/discovery/export/pine")
@RequiredArgsConstructor
public class DiscoveryPineExportController {

    private final DiscoveryPineExportBridge exportBridge;

    @GetMapping("/bullish")
    public PineDiscoveryExportDto bullish(@RequestParam(defaultValue = "60") int days) {
        return exportBridge.bullish(days);
    }

    @GetMapping("/bearish")
    public PineDiscoveryExportDto bearish(@RequestParam(defaultValue = "60") int days) {
        return exportBridge.bearish(days);
    }

    @GetMapping("/put-assist")
    public PineDiscoveryExportDto putAssist(@RequestParam(defaultValue = "60") int days) {
        return exportBridge.putAssist(days);
    }
}
