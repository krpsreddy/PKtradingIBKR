package com.tradingbot.intelligence.live;

import com.tradingbot.intelligence.snapshot.dto.IntelligenceSnapshotDtos.ScannerSnapshotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Phase 187 — live scanner REST (realtime-first). */
@RestController
@RequiredArgsConstructor
public class LiveScannerController {

    private final LiveScannerService liveScannerService;

    @GetMapping("/api/live-scanner/snapshot")
    public ScannerSnapshotDto snapshot() {
        return liveScannerService.currentSnapshot();
    }

    @GetMapping("/api/live-scanner/opportunities")
    public ScannerSnapshotDto opportunities(@RequestParam(required = false) List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return liveScannerService.currentSnapshot();
        }
        return liveScannerService.scan(symbols);
    }
}
