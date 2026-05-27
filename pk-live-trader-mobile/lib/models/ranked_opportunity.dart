class RankedOpportunity {
  const RankedOpportunity({
    required this.symbol,
    required this.regime,
    required this.action,
    required this.tone,
    required this.badge,
    required this.maturityState,
    required this.conviction,
    required this.convictionVelocity,
    required this.persistenceSeconds,
    required this.institutionalPressure,
    required this.expansionProbability,
    required this.dominanceScore,
    required this.whyNow,
    required this.entryZoneLabel,
    required this.riskLabel,
    required this.emergingFast,
    required this.degrading,
    required this.updatedAt,
  });

  final String symbol;
  final String regime;
  final String action;
  final String tone;
  final String badge;
  final String maturityState;
  final int conviction;
  final int convictionVelocity;
  final int persistenceSeconds;
  final int institutionalPressure;
  final int expansionProbability;
  final int dominanceScore;
  final List<String> whyNow;
  final String entryZoneLabel;
  final String riskLabel;
  final bool emergingFast;
  final bool degrading;
  final int updatedAt;

  factory RankedOpportunity.fromJson(Map<String, dynamic> j) {
    final why = j['whyNow'];
    return RankedOpportunity(
      symbol: j['symbol'] as String? ?? '',
      regime: j['regime'] as String? ?? '',
      action: j['action'] as String? ?? '',
      tone: j['tone'] as String? ?? 'YELLOW',
      badge: j['badge'] as String? ?? '',
      maturityState: j['maturityState'] as String? ?? 'DEVELOPING',
      conviction: (j['conviction'] as num?)?.toInt() ?? 0,
      convictionVelocity: (j['convictionVelocity'] as num?)?.toInt() ?? 0,
      persistenceSeconds: (j['persistenceSeconds'] as num?)?.toInt() ?? 0,
      institutionalPressure: (j['institutionalPressure'] as num?)?.toInt() ?? 0,
      expansionProbability: (j['expansionProbability'] as num?)?.toInt() ?? 0,
      dominanceScore: (j['dominanceScore'] as num?)?.toInt() ?? 0,
      whyNow: why is List ? why.map((e) => e.toString()).toList() : const [],
      entryZoneLabel: j['entryZoneLabel'] as String? ?? '',
      riskLabel: j['riskLabel'] as String? ?? '',
      emergingFast: j['emergingFast'] as bool? ?? false,
      degrading: j['degrading'] as bool? ?? false,
      updatedAt: (j['updatedAt'] as num?)?.toInt() ?? 0,
    );
  }
}
