class PortfolioState {
  const PortfolioState({
    this.activePosition,
    this.queued = const [],
    this.suppressed = const [],
    this.correlationBlocks = const [],
    this.qualityRejected = const [],
    this.marketRejected = const [],
    this.replacementCandidates = const [],
    this.maxActivePositions = 1,
    this.queueSize = 0,
    this.updatedAt = 0,
  });

  final ActivePortfolioSlot? activePosition;
  final List<PortfolioOpportunitySlot> queued;
  final List<PortfolioOpportunitySlot> suppressed;
  final List<PortfolioOpportunitySlot> correlationBlocks;
  final List<PortfolioOpportunitySlot> qualityRejected;
  final List<PortfolioOpportunitySlot> marketRejected;
  final List<PortfolioOpportunitySlot> replacementCandidates;
  final int maxActivePositions;
  final int queueSize;
  final int updatedAt;

  factory PortfolioState.fromJson(Map<String, dynamic> j) => PortfolioState(
        activePosition: j['activePosition'] != null
            ? ActivePortfolioSlot.fromJson(j['activePosition'] as Map<String, dynamic>)
            : null,
        queued: _slots(j['queued']),
        suppressed: _slots(j['suppressed']),
        correlationBlocks: _slots(j['correlationBlocks']),
        qualityRejected: _slots(j['qualityRejected']),
        marketRejected: _slots(j['marketRejected']),
        replacementCandidates: _slots(j['replacementCandidates']),
        maxActivePositions: (j['maxActivePositions'] as num?)?.toInt() ?? 1,
        queueSize: (j['queueSize'] as num?)?.toInt() ?? 0,
        updatedAt: (j['updatedAt'] as num?)?.toInt() ?? 0,
      );

  static List<PortfolioOpportunitySlot> _slots(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(PortfolioOpportunitySlot.fromJson)
        .toList();
  }
}

class ActivePortfolioSlot {
  const ActivePortfolioSlot({
    required this.symbol,
    required this.regime,
    required this.sectorCluster,
    required this.lifecycle,
    required this.dominance,
    required this.conviction,
    required this.velocityTrend,
    this.holdDurationSec,
    required this.state,
  });

  final String symbol;
  final String regime;
  final String sectorCluster;
  final String lifecycle;
  final int dominance;
  final int conviction;
  final String velocityTrend;
  final int? holdDurationSec;
  final String state;

  factory ActivePortfolioSlot.fromJson(Map<String, dynamic> j) => ActivePortfolioSlot(
        symbol: j['symbol'] as String? ?? '',
        regime: j['regime'] as String? ?? '',
        sectorCluster: j['sectorCluster'] as String? ?? '',
        lifecycle: j['lifecycle'] as String? ?? '',
        dominance: (j['dominance'] as num?)?.toInt() ?? 0,
        conviction: (j['conviction'] as num?)?.toInt() ?? 0,
        velocityTrend: j['velocityTrend'] as String? ?? '',
        holdDurationSec: (j['holdDurationSec'] as num?)?.toInt(),
        state: j['state'] as String? ?? 'ACTIVE',
      );
}

class PortfolioOpportunitySlot {
  const PortfolioOpportunitySlot({
    required this.symbol,
    required this.regime,
    required this.state,
    required this.reason,
    required this.dominance,
    required this.conviction,
    required this.persistence,
    required this.executionQuality,
    required this.lifecycle,
    required this.queuedAt,
  });

  final String symbol;
  final String regime;
  final String state;
  final String reason;
  final int dominance;
  final int conviction;
  final int persistence;
  final String executionQuality;
  final String lifecycle;
  final int queuedAt;

  factory PortfolioOpportunitySlot.fromJson(Map<String, dynamic> j) => PortfolioOpportunitySlot(
        symbol: j['symbol'] as String? ?? '',
        regime: j['regime'] as String? ?? '',
        state: j['state'] as String? ?? '',
        reason: j['reason'] as String? ?? '',
        dominance: (j['dominance'] as num?)?.toInt() ?? 0,
        conviction: (j['conviction'] as num?)?.toInt() ?? 0,
        persistence: (j['persistence'] as num?)?.toInt() ?? 0,
        executionQuality: j['executionQuality'] as String? ?? '',
        lifecycle: j['lifecycle'] as String? ?? '',
        queuedAt: (j['queuedAt'] as num?)?.toInt() ?? 0,
      );
}
