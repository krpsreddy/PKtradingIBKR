class TradingViewSignal {
  const TradingViewSignal({
    required this.symbol,
    required this.direction,
    required this.dominance,
    required this.conviction,
    required this.persistence,
    required this.rvol,
    required this.lifecycle,
    required this.regime,
    required this.executionQuality,
    required this.bearishBias,
    required this.putGrade,
    required this.deterioration,
    required this.conflictLevel,
    required this.pmState,
    required this.sourceTimestamp,
    required this.receivedAtMs,
    required this.stale,
    required this.source,
  });

  final String symbol;
  final String direction;
  final int dominance;
  final int conviction;
  final int persistence;
  final double rvol;
  final String lifecycle;
  final String regime;
  final String executionQuality;
  final int bearishBias;
  final String putGrade;
  final String deterioration;
  final String conflictLevel;
  final String pmState;
  final int sourceTimestamp;
  final int receivedAtMs;
  final bool stale;
  final String source;

  factory TradingViewSignal.fromJson(Map<String, dynamic> j) => TradingViewSignal(
        symbol: j['symbol'] as String? ?? '',
        direction: j['direction'] as String? ?? 'NEUTRAL',
        dominance: (j['dominance'] as num?)?.toInt() ?? 0,
        conviction: (j['conviction'] as num?)?.toInt() ?? 0,
        persistence: (j['persistence'] as num?)?.toInt() ?? 0,
        rvol: (j['rvol'] as num?)?.toDouble() ?? 0,
        lifecycle: j['lifecycle'] as String? ?? '',
        regime: j['regime'] as String? ?? '',
        executionQuality: j['executionQuality'] as String? ?? '',
        bearishBias: (j['bearishBias'] as num?)?.toInt() ?? 0,
        putGrade: j['putGrade'] as String? ?? 'NONE',
        deterioration: j['deterioration'] as String? ?? '',
        conflictLevel: j['conflictLevel'] as String? ?? '',
        pmState: j['pmState'] as String? ?? '',
        sourceTimestamp: (j['sourceTimestamp'] as num?)?.toInt() ?? 0,
        receivedAtMs: (j['receivedAtMs'] as num?)?.toInt() ?? 0,
        stale: j['stale'] as bool? ?? false,
        source: j['source'] as String? ?? 'TV',
      );
}

class TradingViewHealth {
  const TradingViewHealth({
    required this.lastSignalAtMs,
    required this.activeSignals,
    required this.staleSignals,
    required this.dedupedLastHour,
    required this.healthy,
  });

  final int lastSignalAtMs;
  final int activeSignals;
  final int staleSignals;
  final int dedupedLastHour;
  final bool healthy;

  factory TradingViewHealth.fromJson(Map<String, dynamic> j) => TradingViewHealth(
        lastSignalAtMs: (j['lastSignalAtMs'] as num?)?.toInt() ?? 0,
        activeSignals: (j['activeSignals'] as num?)?.toInt() ?? 0,
        staleSignals: (j['staleSignals'] as num?)?.toInt() ?? 0,
        dedupedLastHour: (j['dedupedLastHour'] as num?)?.toInt() ?? 0,
        healthy: j['healthy'] as bool? ?? false,
      );
}

class TradingViewFeed {
  const TradingViewFeed({
    required this.generatedAtMs,
    required this.health,
    required this.topBullish,
    required this.topBearish,
    required this.topPutAssist,
    required this.highPersistence,
    required this.strongestContinuation,
    required this.highConflict,
    required this.collapsing,
  });

  final int generatedAtMs;
  final TradingViewHealth health;
  final List<TradingViewSignal> topBullish;
  final List<TradingViewSignal> topBearish;
  final List<TradingViewSignal> topPutAssist;
  final List<TradingViewSignal> highPersistence;
  final List<TradingViewSignal> strongestContinuation;
  final List<TradingViewSignal> highConflict;
  final List<TradingViewSignal> collapsing;

  factory TradingViewFeed.fromJson(Map<String, dynamic> j) {
    List<TradingViewSignal> parse(dynamic raw) {
      if (raw is! List) return [];
      return raw
          .whereType<Map<String, dynamic>>()
          .map(TradingViewSignal.fromJson)
          .toList();
    }

    return TradingViewFeed(
      generatedAtMs: (j['generatedAtMs'] as num?)?.toInt() ?? 0,
      health: TradingViewHealth.fromJson(
          j['health'] as Map<String, dynamic>? ?? {}),
      topBullish: parse(j['topBullish']),
      topBearish: parse(j['topBearish']),
      topPutAssist: parse(j['topPutAssist']),
      highPersistence: parse(j['highPersistence']),
      strongestContinuation: parse(j['strongestContinuation']),
      highConflict: parse(j['highConflict']),
      collapsing: parse(j['collapsing']),
    );
  }
}
