class StreamSymbolRow {
  const StreamSymbolRow({
    required this.symbol,
    required this.tier,
    required this.reason,
    required this.priorityScore,
    required this.dominanceScore,
    required this.lifecycle,
    required this.ibkrSubscribed,
    this.tickHealth = 'UNKNOWN',
  });

  final String symbol;
  final String tier;
  final String reason;
  final int priorityScore;
  final int dominanceScore;
  final String lifecycle;
  final bool ibkrSubscribed;
  final String tickHealth;

  factory StreamSymbolRow.fromJson(Map<String, dynamic> j) {
    return StreamSymbolRow(
      symbol: j['symbol'] as String? ?? '',
      tier: j['tier'] as String? ?? '',
      reason: j['reason'] as String? ?? '',
      priorityScore: (j['priorityScore'] as num?)?.toInt() ?? 0,
      dominanceScore: (j['dominanceScore'] as num?)?.toInt() ?? 0,
      lifecycle: j['lifecycle'] as String? ?? '',
      ibkrSubscribed: j['ibkrSubscribed'] as bool? ?? false,
      tickHealth: j['tickHealth'] as String? ?? 'UNKNOWN',
    );
  }
}

class StreamState {
  const StreamState({
    required this.dynamicEnabled,
    required this.realtimeUsed,
    required this.realtimeMax,
    required this.registrySubscriptions,
    required this.realtime,
    required this.snapshot,
    required this.dormant,
    required this.promotionQueue,
    required this.demotionQueue,
    this.staleStreams = const [],
    this.deadStreams = const [],
    this.reconnectAttempts = 0,
    this.avgTickLatencyMs = -1,
    this.lastSuccessfulTickMs = 0,
    this.streamHealthScore = 0,
    this.ibkrPhase = 'DISCONNECTED',
  });

  final bool dynamicEnabled;
  final int realtimeUsed;
  final int realtimeMax;
  final int registrySubscriptions;
  final List<StreamSymbolRow> realtime;
  final List<StreamSymbolRow> snapshot;
  final List<StreamSymbolRow> dormant;
  final List<String> promotionQueue;
  final List<String> demotionQueue;
  final List<String> staleStreams;
  final List<String> deadStreams;
  final int reconnectAttempts;
  final int avgTickLatencyMs;
  final int lastSuccessfulTickMs;
  final int streamHealthScore;
  final String ibkrPhase;

  factory StreamState.fromJson(Map<String, dynamic> j) {
    List<StreamSymbolRow> parseList(dynamic raw) {
      if (raw is! List) return [];
      return raw
          .whereType<Map<String, dynamic>>()
          .map(StreamSymbolRow.fromJson)
          .toList();
    }

    List<String> parseStrings(dynamic raw) {
      if (raw is! List) return [];
      return raw.map((e) => e.toString()).toList();
    }

    return StreamState(
      dynamicEnabled: j['dynamicEnabled'] as bool? ?? false,
      realtimeUsed: (j['realtimeUsed'] as num?)?.toInt() ?? 0,
      realtimeMax: (j['realtimeMax'] as num?)?.toInt() ?? 0,
      registrySubscriptions: (j['registrySubscriptions'] as num?)?.toInt() ?? 0,
      realtime: parseList(j['realtime']),
      snapshot: parseList(j['snapshot']),
      dormant: parseList(j['dormant']),
      promotionQueue: parseStrings(j['promotionQueue']),
      demotionQueue: parseStrings(j['demotionQueue']),
      staleStreams: parseStrings(j['staleStreams']),
      deadStreams: parseStrings(j['deadStreams']),
      reconnectAttempts: (j['reconnectAttempts'] as num?)?.toInt() ?? 0,
      avgTickLatencyMs: (j['avgTickLatencyMs'] as num?)?.toInt() ?? -1,
      lastSuccessfulTickMs: (j['lastSuccessfulTickMs'] as num?)?.toInt() ?? 0,
      streamHealthScore: (j['streamHealthScore'] as num?)?.toInt() ?? 0,
      ibkrPhase: j['ibkrPhase'] as String? ?? 'DISCONNECTED',
    );
  }
}
