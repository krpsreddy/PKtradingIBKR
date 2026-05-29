class RuntimeControls {
  const RuntimeControls({
    required this.scanningEnabled,
    required this.telegramEnabled,
    required this.autoExecutionEnabled,
    required this.executionMode,
    required this.backgroundHydrationEnabled,
    required this.backgroundHydrationPending,
    this.killSwitchActive = false,
    this.bearishAssistMode = 'LONG_PLUS_PUT_ASSIST',
  });

  final bool scanningEnabled;
  final bool telegramEnabled;
  final bool autoExecutionEnabled;
  final String executionMode;
  final bool backgroundHydrationEnabled;
  final int backgroundHydrationPending;
  final bool killSwitchActive;
  final String bearishAssistMode;

  bool get paperResearch => executionMode == 'PAPER_RESEARCH';

  bool get putAssistEnabled => bearishAssistMode == 'LONG_PLUS_PUT_ASSIST';

  RuntimeControls copyWith({
    bool? scanningEnabled,
    bool? telegramEnabled,
    bool? autoExecutionEnabled,
    String? executionMode,
    bool? backgroundHydrationEnabled,
    int? backgroundHydrationPending,
    String? bearishAssistMode,
  }) =>
      RuntimeControls(
        scanningEnabled: scanningEnabled ?? this.scanningEnabled,
        telegramEnabled: telegramEnabled ?? this.telegramEnabled,
        autoExecutionEnabled: autoExecutionEnabled ?? this.autoExecutionEnabled,
        executionMode: executionMode ?? this.executionMode,
        backgroundHydrationEnabled:
            backgroundHydrationEnabled ?? this.backgroundHydrationEnabled,
        backgroundHydrationPending:
            backgroundHydrationPending ?? this.backgroundHydrationPending,
        bearishAssistMode: bearishAssistMode ?? this.bearishAssistMode,
      );

  factory RuntimeControls.fromJson(Map<String, dynamic> j) => RuntimeControls(
        scanningEnabled: j['scanningEnabled'] as bool? ?? true,
        telegramEnabled: j['telegramEnabled'] as bool? ?? false,
        autoExecutionEnabled: j['autoExecutionEnabled'] as bool? ?? false,
        executionMode: j['executionMode'] as String? ?? 'OFF',
        backgroundHydrationEnabled:
            j['backgroundHydrationEnabled'] as bool? ?? true,
        backgroundHydrationPending:
            (j['backgroundHydrationPending'] as num?)?.toInt() ?? 0,
        killSwitchActive: j['killSwitchActive'] as bool? ?? false,
        bearishAssistMode:
            j['bearishAssistMode'] as String? ?? 'LONG_PLUS_PUT_ASSIST',
      );

  Map<String, dynamic> toPatchJson() => {
        'scanningEnabled': scanningEnabled,
        'telegramEnabled': telegramEnabled,
        'autoExecutionEnabled': autoExecutionEnabled,
        'executionMode': executionMode,
        'backgroundHydrationEnabled': backgroundHydrationEnabled,
        'bearishAssistMode': bearishAssistMode,
      };
}
