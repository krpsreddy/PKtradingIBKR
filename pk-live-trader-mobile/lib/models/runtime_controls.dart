class RuntimeControls {
  const RuntimeControls({
    required this.scanningEnabled,
    required this.telegramEnabled,
    required this.autoExecutionEnabled,
    required this.executionMode,
  });

  final bool scanningEnabled;
  final bool telegramEnabled;
  final bool autoExecutionEnabled;
  final String executionMode;

  bool get paperResearch => executionMode == 'PAPER_RESEARCH';

  RuntimeControls copyWith({
    bool? scanningEnabled,
    bool? telegramEnabled,
    bool? autoExecutionEnabled,
    String? executionMode,
  }) =>
      RuntimeControls(
        scanningEnabled: scanningEnabled ?? this.scanningEnabled,
        telegramEnabled: telegramEnabled ?? this.telegramEnabled,
        autoExecutionEnabled: autoExecutionEnabled ?? this.autoExecutionEnabled,
        executionMode: executionMode ?? this.executionMode,
      );

  factory RuntimeControls.fromJson(Map<String, dynamic> j) => RuntimeControls(
        scanningEnabled: j['scanningEnabled'] as bool? ?? true,
        telegramEnabled: j['telegramEnabled'] as bool? ?? false,
        autoExecutionEnabled: j['autoExecutionEnabled'] as bool? ?? false,
        executionMode: j['executionMode'] as String? ?? 'OFF',
      );

  Map<String, dynamic> toPatchJson() => {
        'scanningEnabled': scanningEnabled,
        'telegramEnabled': telegramEnabled,
        'autoExecutionEnabled': autoExecutionEnabled,
        'executionMode': executionMode,
      };
}
