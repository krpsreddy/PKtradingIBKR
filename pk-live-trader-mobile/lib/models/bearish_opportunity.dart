/// Phase 210 — top bearish PUT assist row from snapshot.
class BearishOpportunity {
  const BearishOpportunity({
    required this.symbol,
    required this.bearishRegime,
    required this.breakdownQuality,
    required this.bearishBias,
    required this.persistenceSeconds,
    required this.breakdownProbability,
    required this.squeezeRisk,
    required this.putGrade,
    required this.narrative,
  });

  final String symbol;
  final String bearishRegime;
  final String breakdownQuality;
  final int bearishBias;
  final int persistenceSeconds;
  final int breakdownProbability;
  final int squeezeRisk;
  final String putGrade;
  final String narrative;

  factory BearishOpportunity.fromJson(Map<String, dynamic> j) {
    return BearishOpportunity(
      symbol: j['symbol'] as String? ?? '',
      bearishRegime: j['bearishRegime'] as String? ?? '',
      breakdownQuality: j['breakdownQuality'] as String? ?? '',
      bearishBias: (j['bearishBias'] as num?)?.toInt() ?? 0,
      persistenceSeconds: (j['persistenceSeconds'] as num?)?.toInt() ?? 0,
      breakdownProbability: (j['breakdownProbability'] as num?)?.toInt() ?? 0,
      squeezeRisk: (j['squeezeRisk'] as num?)?.toInt() ?? 0,
      putGrade: j['putGrade'] as String? ?? '',
      narrative: j['narrative'] as String? ?? '',
    );
  }
}
