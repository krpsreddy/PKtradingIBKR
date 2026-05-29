class OperationalMonitor {
  const OperationalMonitor({
    required this.ibkrConnected,
    required this.ibkrReady,
    required this.ibkrStreaming,
    required this.quoteFreshness,
    required this.scannerEnabled,
    required this.autoExecutionEnabled,
    required this.killSwitchActive,
    required this.scannerGeneration,
    required this.scannerAgeMs,
    required this.telemetryLogCount,
    required this.openPaperPositions,
    required this.executionMode,
    this.brokerLatencyMs,
    this.dataIntegrityState = 'LIVE',
    this.dataIntegrityScore = 100,
    this.executionBlockedByData = false,
    this.recentTelemetry = const [],
    this.safetyMessages = const [],
    this.verifiedActiveStreams = 0,
    this.registrySubscriptions = 0,
    this.staleStreamCount = 0,
    this.deadStreamCount = 0,
    this.reconnectAttempts = 0,
    this.avgTickLatencyMs = -1,
    this.lastSuccessfulTickMs = 0,
    this.streamHealthScore = 0,
    this.ibkrPhase = 'DISCONNECTED',
  });

  final bool ibkrConnected;
  final bool ibkrReady;
  final bool ibkrStreaming;
  final String quoteFreshness;
  final bool scannerEnabled;
  final bool autoExecutionEnabled;
  final bool killSwitchActive;
  final int scannerGeneration;
  final int scannerAgeMs;
  final int telemetryLogCount;
  final int openPaperPositions;
  final String executionMode;
  final int? brokerLatencyMs;
  final String dataIntegrityState;
  final int dataIntegrityScore;
  final bool executionBlockedByData;
  final List<TelemetryLog> recentTelemetry;
  final List<String> safetyMessages;
  final int verifiedActiveStreams;
  final int registrySubscriptions;
  final int staleStreamCount;
  final int deadStreamCount;
  final int reconnectAttempts;
  final int avgTickLatencyMs;
  final int lastSuccessfulTickMs;
  final int streamHealthScore;
  final String ibkrPhase;

  int get lastTickAgeMs {
    if (lastSuccessfulTickMs <= 0) return -1;
    return DateTime.now().millisecondsSinceEpoch - lastSuccessfulTickMs;
  }

  factory OperationalMonitor.fromJson(Map<String, dynamic> j) {
    final logs = j['recentTelemetry'];
    final safety = j['safetyMessages'];
    return OperationalMonitor(
      ibkrConnected: j['ibkrConnected'] as bool? ?? false,
      ibkrReady: j['ibkrReady'] as bool? ?? false,
      ibkrStreaming: j['ibkrStreaming'] as bool? ?? false,
      quoteFreshness: j['quoteFreshness'] as String? ?? 'OFFLINE',
      scannerEnabled: j['scannerEnabled'] as bool? ?? false,
      autoExecutionEnabled: j['autoExecutionEnabled'] as bool? ?? false,
      killSwitchActive: j['killSwitchActive'] as bool? ?? false,
      scannerGeneration: (j['scannerGeneration'] as num?)?.toInt() ?? 0,
      scannerAgeMs: (j['scannerAgeMs'] as num?)?.toInt() ?? 0,
      telemetryLogCount: (j['telemetryLogCount'] as num?)?.toInt() ?? 0,
      openPaperPositions: (j['openPaperPositions'] as num?)?.toInt() ?? 0,
      executionMode: j['executionMode'] as String? ?? 'OFF',
      brokerLatencyMs: (j['brokerLatencyMs'] as num?)?.toInt(),
      dataIntegrityState: j['dataIntegrityState'] as String? ?? 'LIVE',
      dataIntegrityScore: (j['dataIntegrityScore'] as num?)?.toInt() ?? 100,
      executionBlockedByData: j['executionBlockedByData'] as bool? ?? false,
      recentTelemetry: logs is List
          ? logs
              .whereType<Map<String, dynamic>>()
              .map(TelemetryLog.fromJson)
              .toList()
          : const [],
      safetyMessages: safety is List
          ? safety.map((e) => e.toString()).toList()
          : const [],
      verifiedActiveStreams: (j['verifiedActiveStreams'] as num?)?.toInt() ?? 0,
      registrySubscriptions: (j['registrySubscriptions'] as num?)?.toInt() ?? 0,
      staleStreamCount: (j['staleStreamCount'] as num?)?.toInt() ?? 0,
      deadStreamCount: (j['deadStreamCount'] as num?)?.toInt() ?? 0,
      reconnectAttempts: (j['reconnectAttempts'] as num?)?.toInt() ?? 0,
      avgTickLatencyMs: (j['avgTickLatencyMs'] as num?)?.toInt() ?? -1,
      lastSuccessfulTickMs: (j['lastSuccessfulTickMs'] as num?)?.toInt() ?? 0,
      streamHealthScore: (j['streamHealthScore'] as num?)?.toInt() ?? 0,
      ibkrPhase: j['ibkrPhase'] as String? ?? 'DISCONNECTED',
    );
  }
}

class TelemetryLog {
  const TelemetryLog({
    required this.symbol,
    required this.regime,
    required this.executionQuality,
    required this.entryReason,
    this.exitReason,
    this.realizedR,
    required this.timestamp,
  });

  final String symbol;
  final String regime;
  final String executionQuality;
  final String entryReason;
  final String? exitReason;
  final double? realizedR;
  final int timestamp;

  factory TelemetryLog.fromJson(Map<String, dynamic> j) => TelemetryLog(
        symbol: j['symbol'] as String? ?? '',
        regime: j['regime'] as String? ?? '',
        executionQuality: j['executionQuality'] as String? ?? '',
        entryReason: j['entryReason'] as String? ?? '',
        exitReason: j['exitReason'] as String?,
        realizedR: (j['realizedR'] as num?)?.toDouble(),
        timestamp: (j['timestamp'] as num?)?.toInt() ?? 0,
      );
}
