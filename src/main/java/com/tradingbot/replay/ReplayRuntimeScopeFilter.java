package com.tradingbot.replay;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Phase 193 — marks replay API requests so live scanner/hydration defer while replay is active.
 */
@Component
@Order(10)
@RequiredArgsConstructor
public class ReplayRuntimeScopeFilter extends OncePerRequestFilter {

    private final ReplayRuntimeMode replayRuntimeMode;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path == null
                || (!path.contains("/api/replay")
                && !path.contains("/api/replay-cache")
                && !path.contains("/api/execution-review"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try (var ignored = replayRuntimeMode.enter()) {
            chain.doFilter(request, response);
        }
    }
}
