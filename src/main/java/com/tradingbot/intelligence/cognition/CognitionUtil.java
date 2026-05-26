package com.tradingbot.intelligence.cognition;

import java.util.Collections;
import java.util.List;

final class CognitionUtil {
    private CognitionUtil() {}

    static boolean hasItems(List<?> list) {
        return list != null && !list.isEmpty();
    }

    static <T> List<T> safe(List<T> list) {
        return list != null ? list : Collections.emptyList();
    }
}
