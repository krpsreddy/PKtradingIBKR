package com.tradingbot.intelligence.live;

/** In-memory rolling state per symbol for live dominance / velocity. */
public final class LiveSymbolScanState {

    private volatile String sessionKey = "";
    private volatile int lastConviction;
    private volatile int convictionVelocity;
    private volatile int dominanceScore;
    private volatile int topRankHits;
    private volatile long lastEvalMs;

    public void resetForSession(String newSessionKey) {
        sessionKey = newSessionKey;
        lastConviction = 0;
        convictionVelocity = 0;
        dominanceScore = 0;
        topRankHits = 0;
        lastEvalMs = 0;
    }

    public void update(String sessionKey, int conviction, int expansion, int persistence, double rvol) {
        if (!sessionKey.equals(this.sessionKey)) {
            resetForSession(sessionKey);
        }
        convictionVelocity = conviction - lastConviction;
        lastConviction = conviction;
        int rvolBoost = rvol >= 2.5 ? 12 : (rvol >= 1.5 ? 6 : 0);
        dominanceScore = conviction
                + Math.max(0, convictionVelocity) * 2
                + expansion / 4
                + persistence / 5
                + rvolBoost;
        lastEvalMs = System.currentTimeMillis();
    }

    public void recordTopRank() {
        topRankHits++;
    }

    public String sessionKey() {
        return sessionKey;
    }

    public int lastConviction() {
        return lastConviction;
    }

    public int convictionVelocity() {
        return convictionVelocity;
    }

    public int dominanceScore() {
        return dominanceScore;
    }

    public int topRankHits() {
        return topRankHits;
    }

    public long lastEvalMs() {
        return lastEvalMs;
    }

    /** Phase 205 — seed dominance after gap recovery (monitoring only until LIVE). */
    public void rebuildFromCandles(int continuityScore) {
        dominanceScore = Math.max(0, Math.min(120, continuityScore));
        lastEvalMs = System.currentTimeMillis();
    }
}
