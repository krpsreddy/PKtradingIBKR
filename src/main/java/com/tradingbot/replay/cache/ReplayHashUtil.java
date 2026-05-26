package com.tradingbot.replay.cache;

import com.tradingbot.models.Candle;
import com.tradingbot.services.MarketTime;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;

/** Deterministic hashes for replay staleness detection. */
public final class ReplayHashUtil {

    private ReplayHashUtil() {}

    public static String hashSessionCandles(List<Candle> sessionBars) {
        if (sessionBars == null || sessionBars.isEmpty()) {
            return hashString("empty");
        }
        StringBuilder sb = new StringBuilder(sessionBars.size() * 48);
        for (Candle c : sessionBars) {
            sb.append(MarketTime.formatIso(c.getOpenTime())).append('|')
                    .append(c.getOpen()).append('|')
                    .append(c.getHigh()).append('|')
                    .append(c.getLow()).append('|')
                    .append(c.getClose()).append('|')
                    .append(c.getVolume()).append(';');
        }
        return hashString(sb.toString());
    }

    public static String hashString(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            return Integer.toHexString(input.hashCode());
        }
    }

    public static String sessionKey(String symbol, LocalDate date) {
        return symbol.toUpperCase() + ':' + date;
    }
}
