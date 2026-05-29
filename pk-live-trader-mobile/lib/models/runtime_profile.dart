class RuntimeProfile {
  const RuntimeProfile({
    required this.runtime,
    required this.executionMode,
    required this.port,
    required this.ibkrPort,
    required this.integrityMode,
    required this.brokerType,
    required this.autoPaperEnabled,
    required this.liveExecutionEnabled,
  });

  final String runtime;
  final String executionMode;
  final int port;
  final int ibkrPort;
  final String integrityMode;
  final String brokerType;
  final bool autoPaperEnabled;
  final bool liveExecutionEnabled;

  bool get isPaper => runtime == 'PAPER';
  bool get isLive => runtime == 'LIVE';

  factory RuntimeProfile.fromJson(Map<String, dynamic> json) {
    return RuntimeProfile(
      runtime: json['runtime'] as String? ?? 'PAPER',
      executionMode: json['executionMode'] as String? ?? 'AUTO_PAPER',
      port: (json['port'] as num?)?.toInt() ?? 8180,
      ibkrPort: (json['ibkrPort'] as num?)?.toInt() ?? 4002,
      integrityMode: json['integrityMode'] as String? ?? 'DELAYED_TOLERANT',
      brokerType: json['brokerType'] as String? ?? 'PAPER_GATEWAY',
      autoPaperEnabled: json['autoPaperEnabled'] as bool? ?? false,
      liveExecutionEnabled: json['liveExecutionEnabled'] as bool? ?? false,
    );
  }
}
