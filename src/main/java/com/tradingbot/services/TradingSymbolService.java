package com.tradingbot.services;

import com.tradingbot.api.dto.CreateTradingSymbolRequest;
import com.tradingbot.api.dto.SymbolReorderRequest;
import com.tradingbot.api.dto.TradingSymbolDto;
import com.tradingbot.api.dto.UpdateTradingSymbolRequest;
import com.tradingbot.ibkr.SubscriptionManagerService;
import com.tradingbot.models.TradingSymbol;
import com.tradingbot.repository.TradingSymbolRepository;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TradingSymbolService {

    private final TradingSymbolRepository repository;
    private final SymbolLoadService symbolLoadService;
    private final SubscriptionManagerService subscriptionManager;
    private final SymbolContextRegistry symbolContextRegistry;

    public List<TradingSymbol> findAllConfigured() {
        return repository.findByActiveTrueOrderByPinnedDescDisplayOrderAscSymbolAsc();
    }

    public List<TradingSymbol> findEnabledForDisplay() {
        return repository.findByActiveTrueAndEnabledTrueOrderByPinnedDescDisplayOrderAscSymbolAsc();
    }

    public List<TradingSymbol> findScanEnabled() {
        return repository.findByActiveTrueAndEnabledTrueAndScanEnabledTrueOrderByDisplayOrderAscSymbolAsc();
    }

    public List<TradingSymbol> findPreloadOnStartup() {
        return repository.findByActiveTrueAndEnabledTrueAndPreloadOnStartupTrueOrderByDisplayOrderAscSymbolAsc();
    }

    public List<TradingSymbol> findSubscribeLive() {
        return repository.findByActiveTrueAndEnabledTrueAndSubscribeLiveTrueOrderByDisplayOrderAscSymbolAsc();
    }

    public Set<String> getEnabledSymbolSet() {
        return findEnabledForDisplay().stream()
                .map(TradingSymbol::getSymbol)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public Set<String> getScanSymbolSet() {
        return findScanEnabled().stream()
                .map(TradingSymbol::getSymbol)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public Optional<TradingSymbol> findActive(String symbol) {
        return repository.findBySymbolIgnoreCase(symbol.toUpperCase())
                .filter(TradingSymbol::isActive);
    }

    public Optional<TradingSymbol> findEnabled(String symbol) {
        return findActive(symbol).filter(TradingSymbol::isEnabled);
    }

    public boolean isManagedSymbol(String symbol) {
        return findEnabled(symbol).isPresent();
    }

    @Transactional
    public TradingSymbol createSymbol(CreateTradingSymbolRequest request) {
        String sym = normalizeSymbol(request.getSymbol());
        validateTicker(sym);

    Optional<TradingSymbol> existing = repository.findBySymbolIgnoreCase(sym);
    if (existing.isPresent() && existing.get().isActive()) {
        log.debug("Symbol {} already active — returning existing row", sym);
        return existing.get();
    }

        LocalDateTime now = LocalDateTime.now();
        TradingSymbol row = existing.orElseGet(TradingSymbol::new);
        row.setSymbol(sym);
        row.setActive(true);
        row.setEnabled(request.getEnabled() != null ? request.getEnabled() : true);
        row.setPinned(request.getPinned() != null && request.getPinned());
        row.setGroupName(request.getGroupName() != null ? request.getGroupName() : "Momentum");
        row.setScanEnabled(request.getScanEnabled() != null ? request.getScanEnabled() : true);
        row.setSubscribeLive(request.getSubscribeLive() != null ? request.getSubscribeLive() : true);
        row.setPreloadOnStartup(request.getPreloadOnStartup() != null ? request.getPreloadOnStartup() : true);
        if (row.getCreatedAt() == null) {
            row.setCreatedAt(now);
            row.setDisplayOrder(repository.maxDisplayOrder() + 1);
        }
        row.setUpdatedAt(now);

        TradingSymbol saved = repository.save(row);
        log.info("Added trading symbol {}", sym);
        activateRuntime(saved);
        return saved;
    }

    @Transactional
    public TradingSymbol updateSymbol(String symbol, UpdateTradingSymbolRequest request) {
        TradingSymbol row = requireActive(symbol);
        boolean wasEnabled = row.isEnabled();

        if (request.getGroupName() != null) {
            row.setGroupName(request.getGroupName());
        }
        if (request.getEnabled() != null) {
            row.setEnabled(request.getEnabled());
        }
        if (request.getPinned() != null) {
            row.setPinned(request.getPinned());
        }
        if (request.getScanEnabled() != null) {
            row.setScanEnabled(request.getScanEnabled());
        }
        if (request.getSubscribeLive() != null) {
            row.setSubscribeLive(request.getSubscribeLive());
        }
        if (request.getPreloadOnStartup() != null) {
            row.setPreloadOnStartup(request.getPreloadOnStartup());
        }
        if (request.getDisplayOrder() != null) {
            row.setDisplayOrder(request.getDisplayOrder());
        }
        row.setUpdatedAt(LocalDateTime.now());
        TradingSymbol saved = repository.save(row);

        if (!saved.isEnabled() && wasEnabled) {
            deactivateRuntime(saved);
        } else if (saved.isEnabled() && !wasEnabled) {
            activateRuntime(saved);
        } else if (saved.isEnabled()) {
            applyRuntimeFlags(saved);
        }
        return saved;
    }

    @Transactional
    public void softDelete(String symbol) {
        TradingSymbol row = requireActive(symbol);
        row.setActive(false);
        row.setEnabled(false);
        row.setUpdatedAt(LocalDateTime.now());
        repository.save(row);
        deactivateRuntime(row);
        log.info("Soft-deleted trading symbol {}", row.getSymbol());
    }

    @Transactional
    public TradingSymbol addToWatchlist(String symbol) {
        TradingSymbol row = requireActive(symbol);
        if (!row.isEnabled()) {
            row.setEnabled(true);
            row.setUpdatedAt(LocalDateTime.now());
            row = repository.save(row);
        }
        activateRuntime(row);
        log.info("Added trading symbol {} to watchlist", row.getSymbol());
        return row;
    }

    @Transactional
    public TradingSymbol removeFromWatchlist(String symbol) {
        TradingSymbol row = requireActive(symbol);
        if (row.isEnabled()) {
            row.setEnabled(false);
            row.setUpdatedAt(LocalDateTime.now());
            row = repository.save(row);
            deactivateRuntime(row);
            log.info("Removed trading symbol {} from watchlist", row.getSymbol());
        }
        return row;
    }

    @Transactional
    public TradingSymbol toggleScan(String symbol) {
        TradingSymbol row = requireActive(symbol);
        row.setScanEnabled(!row.isScanEnabled());
        row.setUpdatedAt(LocalDateTime.now());
        TradingSymbol saved = repository.save(row);
        if (saved.isScanEnabled()) {
            log.info("Enabled scanner participation for {}", saved.getSymbol());
        } else {
            log.info("Disabled scanner participation for {}", saved.getSymbol());
        }
        return saved;
    }

    @Transactional
    public TradingSymbol toggleLive(String symbol) {
        TradingSymbol row = requireActive(symbol);
        row.setSubscribeLive(!row.isSubscribeLive());
        row.setUpdatedAt(LocalDateTime.now());
        TradingSymbol saved = repository.save(row);
        if (saved.isSubscribeLive() && saved.isEnabled()) {
            subscriptionManager.subscribeIfNeeded(saved.getSymbol());
            log.info("Enabled live streaming for {}", saved.getSymbol());
        } else {
            subscriptionManager.unsubscribe(saved.getSymbol());
            log.info("Disabled live streaming for {}", saved.getSymbol());
        }
        return saved;
    }

    @Transactional
    public List<TradingSymbol> reorder(SymbolReorderRequest request) {
        if (request.getSymbols() == null || request.getSymbols().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "symbols list is required");
        }
        int order = 0;
        List<TradingSymbol> updated = new ArrayList<>();
        for (String sym : request.getSymbols()) {
            TradingSymbol row = requireActive(sym);
            row.setDisplayOrder(order++);
            row.setUpdatedAt(LocalDateTime.now());
            updated.add(repository.save(row));
        }
        return updated;
    }

    @Transactional
    public void recordLastViewed(String symbol) {
        String sym = normalizeSymbol(symbol);
        repository.findBySymbolIgnoreCase(sym).ifPresent(row -> {
            if (!row.isActive() || !row.isEnabled()) {
                return;
            }
            row.setLastViewedAt(LocalDateTime.now());
            row.setUpdatedAt(LocalDateTime.now());
            repository.save(row);
        });
    }

    public boolean isRecentlyViewed(String symbol, LocalDateTime cutoff) {
        return repository.findBySymbolIgnoreCase(symbol.toUpperCase())
                .map(row -> row.getLastViewedAt() != null && row.getLastViewedAt().isAfter(cutoff))
                .orElse(false);
    }

    public void activateRuntime(TradingSymbol row) {
        if (!row.isActive() || !row.isEnabled()) {
            return;
        }
        String sym = row.getSymbol();
        symbolContextRegistry.getOrCreate(sym);
        if (row.isPreloadOnStartup()) {
            symbolLoadService.activateSymbol(sym);
        }
        if (row.isSubscribeLive()) {
            subscriptionManager.subscribeIfNeeded(sym);
        }
    }

    public void deactivateRuntime(TradingSymbol row) {
        String sym = row.getSymbol();
        subscriptionManager.unsubscribe(sym);
        symbolContextRegistry.evict(sym);
        log.info("Evicted inactive symbol {}", sym);
    }

    public void applyRuntimeFlags(TradingSymbol row) {
        if (!row.isEnabled()) {
            deactivateRuntime(row);
            return;
        }
        if (row.isSubscribeLive()) {
            subscriptionManager.subscribeIfNeeded(row.getSymbol());
        } else {
            subscriptionManager.unsubscribe(row.getSymbol());
        }
        if (row.isPreloadOnStartup()) {
            symbolLoadService.activateSymbol(row.getSymbol());
        }
    }

    public void activateAllOnStartup() {
        for (TradingSymbol row : findAllConfigured()) {
            if (row.isEnabled()) {
                activateRuntime(row);
            }
        }
    }

    public TradingSymbolDto toDto(TradingSymbol row) {
        return TradingSymbolDto.builder()
                .symbol(row.getSymbol())
                .enabled(row.isEnabled())
                .pinned(row.isPinned())
                .groupName(row.getGroupName())
                .scanEnabled(row.isScanEnabled())
                .preloadOnStartup(row.isPreloadOnStartup())
                .subscribeLive(row.isSubscribeLive())
                .displayOrder(row.getDisplayOrder())
                .active(row.isActive())
                .lastViewedAt(row.getLastViewedAt())
                .sector(row.getSector())
                .marketCap(row.getMarketCap())
                .exchange(row.getExchange())
                .floatShares(row.getFloatShares())
                .avgDailyVolume(row.getAvgDailyVolume())
                .build();
    }

    private TradingSymbol requireActive(String symbol) {
        return repository.findBySymbolIgnoreCase(normalizeSymbol(symbol))
                .filter(TradingSymbol::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Symbol not found: " + symbol));
    }

    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol is required");
        }
        return symbol.trim().toUpperCase();
    }

    private void validateTicker(String symbol) {
        if (!symbol.matches("^[A-Z][A-Z0-9.-]{0,9}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid symbol format: " + symbol);
        }
    }
}
