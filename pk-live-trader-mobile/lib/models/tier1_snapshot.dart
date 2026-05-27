import 'ranked_opportunity.dart';

class Tier1Snapshot {
  const Tier1Snapshot({
    required this.dominant,
    required this.topRanked,
    required this.degrading,
    required this.generatedAt,
    required this.feedGeneration,
  });

  final RankedOpportunity? dominant;
  final List<RankedOpportunity> topRanked;
  final List<RankedOpportunity> degrading;
  final int generatedAt;
  final int feedGeneration;

  factory Tier1Snapshot.fromJson(Map<String, dynamic> j) {
    RankedOpportunity? dom;
    final d = j['dominant'];
    if (d is Map<String, dynamic>) dom = RankedOpportunity.fromJson(d);

    List<RankedOpportunity> list(dynamic raw) {
      if (raw is! List) return const [];
      return raw
          .whereType<Map<String, dynamic>>()
          .map(RankedOpportunity.fromJson)
          .toList();
    }

    return Tier1Snapshot(
      dominant: dom,
      topRanked: list(j['topRanked']),
      degrading: list(j['degrading']),
      generatedAt: (j['generatedAt'] as num?)?.toInt() ?? 0,
      feedGeneration: (j['feedGeneration'] as num?)?.toInt() ?? 0,
    );
  }
}
