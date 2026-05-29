package com.tradingbot.replay;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Phase 193 — logs replay API duration and payload size; warns when &gt; 500ms.
 */
@Slf4j
@Component
@Order(20)
public class ReplayRequestTimingFilter extends OncePerRequestFilter {

    private static final long SLOW_MS = 500;

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
        long t0 = System.nanoTime();
        ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(response);
        try {
            chain.doFilter(request, wrapped);
        } finally {
            long ms = (System.nanoTime() - t0) / 1_000_000;
            int bytes = wrapped.getContentAsByteArray().length;
            String path = request.getRequestURI();
            String query = request.getQueryString();
            String endpoint = query != null ? path + "?" + query : path;
            if (ms >= SLOW_MS) {
                log.warn(
                        "REPLAY_SLOW endpoint={} method={} durationMs={} payloadBytes={}",
                        endpoint, request.getMethod(), ms, bytes
                );
            } else {
                log.info(
                        "REPLAY_REQ endpoint={} method={} durationMs={} payloadBytes={}",
                        endpoint, request.getMethod(), ms, bytes
                );
            }
            wrapped.copyBodyToResponse();
        }
    }
}
