class PaperPosition {
  const PaperPosition({
    required this.id,
    required this.symbol,
    required this.regime,
    required this.status,
    this.entryPrice,
    this.fillPrice,
    this.quantity,
    this.mfeR,
    this.maeR,
    this.realizedR,
    this.exitSuggestion,
    this.convictionScore,
    this.dominanceScore,
    this.persistenceDurationSec,
  });

  final int id;
  final String symbol;
  final String regime;
  final String status;
  final double? entryPrice;
  final double? fillPrice;
  final int? quantity;
  final double? mfeR;
  final double? maeR;
  final double? realizedR;
  final String? exitSuggestion;
  final int? convictionScore;
  final int? dominanceScore;
  final int? persistenceDurationSec;

  double? get avgEntry => fillPrice ?? entryPrice;

  factory PaperPosition.fromJson(Map<String, dynamic> j) => PaperPosition(
        id: (j['id'] as num?)?.toInt() ?? 0,
        symbol: j['symbol'] as String? ?? '',
        regime: j['regime'] as String? ?? '',
        status: j['status'] as String? ?? '',
        entryPrice: (j['entryPrice'] as num?)?.toDouble(),
        fillPrice: (j['fillPrice'] as num?)?.toDouble(),
        quantity: (j['quantity'] as num?)?.toInt(),
        mfeR: (j['mfeR'] as num?)?.toDouble(),
        maeR: (j['maeR'] as num?)?.toDouble(),
        realizedR: (j['realizedR'] as num?)?.toDouble(),
        exitSuggestion: j['exitSuggestion'] as String?,
        convictionScore: (j['convictionScore'] as num?)?.toInt(),
        dominanceScore: (j['dominanceScore'] as num?)?.toInt(),
        persistenceDurationSec: (j['persistenceDurationSec'] as num?)?.toInt(),
      );
}

class PnlSummary {
  const PnlSummary({
    required this.unrealizedSumR,
    required this.realizedSumR,
    required this.openPositions,
    required this.closedToday,
    this.avgRealizedR,
    this.continuationCaptures,
  });

  final double unrealizedSumR;
  final double realizedSumR;
  final int openPositions;
  final int closedToday;
  final double? avgRealizedR;
  final int? continuationCaptures;

  factory PnlSummary.fromJson(Map<String, dynamic> j) => PnlSummary(
        unrealizedSumR: (j['unrealizedSumR'] as num?)?.toDouble() ?? 0,
        realizedSumR: (j['realizedSumR'] as num?)?.toDouble() ?? 0,
        openPositions: (j['openPositions'] as num?)?.toInt() ?? 0,
        closedToday: (j['closedToday'] as num?)?.toInt() ?? 0,
        avgRealizedR: (j['avgRealizedR'] as num?)?.toDouble(),
        continuationCaptures: (j['continuationCaptures'] as num?)?.toInt(),
      );
}

class ExecutionAnalytics {
  const ExecutionAnalytics({
    required this.closedCount,
    required this.openCount,
    this.avgRealizedR,
    this.avgMfeR,
    this.avgMaeR,
  });

  final int closedCount;
  final int openCount;
  final double? avgRealizedR;
  final double? avgMfeR;
  final double? avgMaeR;

  factory ExecutionAnalytics.fromJson(Map<String, dynamic> j) => ExecutionAnalytics(
        closedCount: (j['closedCount'] as num?)?.toInt() ?? 0,
        openCount: (j['openCount'] as num?)?.toInt() ?? 0,
        avgRealizedR: (j['avgRealizedR'] as num?)?.toDouble(),
        avgMfeR: (j['avgMfeR'] as num?)?.toDouble(),
        avgMaeR: (j['avgMaeR'] as num?)?.toDouble(),
      );
}

class PaperMonitorSnapshot {
  const PaperMonitorSnapshot({
    required this.activePositions,
    required this.analytics,
  });

  final List<PaperPosition> activePositions;
  final ExecutionAnalytics? analytics;

  factory PaperMonitorSnapshot.fromJson(Map<String, dynamic> j) {
    List<PaperPosition> pos(dynamic raw) {
      if (raw is! List) return const [];
      return raw
          .whereType<Map<String, dynamic>>()
          .map(PaperPosition.fromJson)
          .toList();
    }

    ExecutionAnalytics? analytics;
    final a = j['analytics'];
    if (a is Map<String, dynamic>) analytics = ExecutionAnalytics.fromJson(a);

    return PaperMonitorSnapshot(
      activePositions: pos(j['activePositions']),
      analytics: analytics,
    );
  }
}
