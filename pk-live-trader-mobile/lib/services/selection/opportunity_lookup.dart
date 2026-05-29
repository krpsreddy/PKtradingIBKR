import '../../models/live_trader_snapshot.dart';
import '../../models/ranked_opportunity.dart';
import '../../models/tier1_snapshot.dart';

class OpportunityLookupResult {
  const OpportunityLookupResult({
    required this.opportunity,
    this.listRank,
    this.fromBearishList = false,
  });

  final RankedOpportunity opportunity;
  final int? listRank;
  final bool fromBearishList;
}

/// Find execution intelligence by symbol without re-sorting lists.
class OpportunityLookup {
  OpportunityLookup._();

  static RankedOpportunity? topOpportunity(Tier1Snapshot? t1) {
    if (t1 == null) return null;
    return t1.dominant ?? (t1.topRanked.isNotEmpty ? t1.topRanked.first : null);
  }

  static int? rankInTopRanked(Tier1Snapshot? t1, String? symbol) {
    if (t1 == null || symbol == null || symbol.isEmpty) return null;
    final idx = t1.topRanked.indexWhere((o) => o.symbol == symbol);
    return idx >= 0 ? idx + 1 : null;
  }

  static OpportunityLookupResult? resolve({
    Tier1Snapshot? t1,
    LiveTraderSnapshot? snapshot,
    required String symbol,
  }) {
    if (t1 != null) {
      final dom = t1.dominant;
      if (dom != null && dom.symbol == symbol) {
        return OpportunityLookupResult(
          opportunity: dom,
          listRank: rankInTopRanked(t1, symbol),
        );
      }
      for (var i = 0; i < t1.topRanked.length; i++) {
        if (t1.topRanked[i].symbol == symbol) {
          return OpportunityLookupResult(
            opportunity: t1.topRanked[i],
            listRank: i + 1,
          );
        }
      }
      for (final o in t1.degrading) {
        if (o.symbol == symbol) {
          return OpportunityLookupResult(opportunity: o, listRank: 0);
        }
      }
    }

    final bearish = snapshot?.topBearishOpportunities ?? const [];
    for (final b in bearish) {
      if (b.symbol == symbol) {
        final base = _findInTier1(t1, symbol);
        return OpportunityLookupResult(
          opportunity: RankedOpportunity.fromBearish(b, base: base),
          fromBearishList: true,
        );
      }
    }

    return null;
  }

  static RankedOpportunity? _findInTier1(Tier1Snapshot? t1, String symbol) {
    if (t1 == null) return null;
    if (t1.dominant?.symbol == symbol) return t1.dominant;
    for (final o in t1.topRanked) {
      if (o.symbol == symbol) return o;
    }
    for (final o in t1.degrading) {
      if (o.symbol == symbol) return o;
    }
    return null;
  }
}
