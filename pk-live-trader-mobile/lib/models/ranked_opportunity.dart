import 'bearish_opportunity.dart';

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
    this.executionQuality = 'MEDIUM',
    this.tradeLifecycle = 'DEVELOPING',
    this.velocityTrend = 'FLATTENING',
    this.rvol = 1.0,
    this.stopLabel = '—',
    this.targetLabel = '—',
    this.projectedR = '—',
    this.dataFreshness = 'LIVE',
    this.reliabilityBoost = 0,
    this.marketAligned = true,
    this.lastTickMs = 0,
    this.putAssist,
    this.bearishOps,
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
  final String executionQuality;
  final String tradeLifecycle;
  final String velocityTrend;
  final double rvol;
  final String stopLabel;
  final String targetLabel;
  final String projectedR;
  final String dataFreshness;
  final int reliabilityBoost;
  final bool marketAligned;
  final int lastTickMs;
  final PutAssistAdvisory? putAssist;
  final BearishOperationalOverlay? bearishOps;

  /// Phase 215 — hero focus from bearish list when symbol not in tier1 ranked rows.
  factory RankedOpportunity.fromBearish(BearishOpportunity b, {RankedOpportunity? base}) {
    if (base != null) {
      return RankedOpportunity(
        symbol: base.symbol,
        regime: base.regime.isNotEmpty ? base.regime : b.bearishRegime,
        action: base.action,
        tone: base.tone,
        badge: base.badge,
        maturityState: base.maturityState,
        conviction: base.conviction,
        convictionVelocity: base.convictionVelocity,
        persistenceSeconds: b.persistenceSeconds > 0 ? b.persistenceSeconds : base.persistenceSeconds,
        institutionalPressure: base.institutionalPressure,
        expansionProbability: base.expansionProbability,
        dominanceScore: base.dominanceScore,
        whyNow: base.whyNow.isNotEmpty ? base.whyNow : [if (b.narrative.isNotEmpty) b.narrative],
        entryZoneLabel: base.entryZoneLabel,
        riskLabel: base.riskLabel,
        emergingFast: base.emergingFast,
        degrading: true,
        updatedAt: base.updatedAt,
        executionQuality: base.executionQuality,
        tradeLifecycle: base.tradeLifecycle,
        velocityTrend: base.velocityTrend,
        rvol: base.rvol,
        stopLabel: base.stopLabel,
        targetLabel: base.targetLabel,
        projectedR: base.projectedR,
        dataFreshness: base.dataFreshness,
        reliabilityBoost: base.reliabilityBoost,
        marketAligned: base.marketAligned,
        lastTickMs: base.lastTickMs,
        putAssist: PutAssistAdvisory(
          active: true,
          bearishBias: b.bearishBias,
          bearishState: b.bearishRegime,
          breakdownProbability: '${b.breakdownProbability}',
          confidence: b.breakdownQuality,
          badgeLabel: 'PUT ${b.putGrade}',
          putAssistGrade: b.putGrade,
        ),
        bearishOps: BearishOperationalOverlay(
          deterioration: b.breakdownQuality,
          putAssistGrade: b.putGrade,
          directionalConflict: base.bearishOps?.directionalConflict,
          longSuppression: base.bearishOps?.longSuppression,
          premarketChip: base.bearishOps?.premarketChip,
          operationalChip: base.bearishOps?.operationalChip ?? 'BEARISH',
        ),
      );
    }
    return RankedOpportunity(
      symbol: b.symbol,
      regime: b.bearishRegime,
      action: 'PUT_ASSIST',
      tone: 'RED',
      badge: 'PUT ${b.putGrade}',
      maturityState: 'BEARISH',
      conviction: 0,
      convictionVelocity: 0,
      persistenceSeconds: b.persistenceSeconds,
      institutionalPressure: 0,
      expansionProbability: 0,
      dominanceScore: 0,
      whyNow: [if (b.narrative.isNotEmpty) b.narrative],
      entryZoneLabel: '',
      riskLabel: '',
      emergingFast: false,
      degrading: true,
      updatedAt: 0,
      executionQuality: b.breakdownQuality,
      tradeLifecycle: b.bearishRegime,
      velocityTrend: 'DECAYING',
      rvol: 1.0,
      stopLabel: '—',
      targetLabel: '—',
      projectedR: '—',
      dataFreshness: 'LIVE',
      putAssist: PutAssistAdvisory(
        active: true,
        bearishBias: b.bearishBias,
        bearishState: b.bearishRegime,
        breakdownProbability: '${b.breakdownProbability}',
        confidence: b.breakdownQuality,
        badgeLabel: 'PUT ${b.putGrade}',
        putAssistGrade: b.putGrade,
      ),
      bearishOps: BearishOperationalOverlay(
        deterioration: b.breakdownQuality,
        putAssistGrade: b.putGrade,
        operationalChip: 'BEARISH',
      ),
    );
  }

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
      executionQuality: j['executionQuality'] as String? ?? 'MEDIUM',
      tradeLifecycle: j['tradeLifecycle'] as String? ?? 'DEVELOPING',
      velocityTrend: j['velocityTrend'] as String? ?? 'FLATTENING',
      rvol: (j['rvol'] as num?)?.toDouble() ?? 1.0,
      stopLabel: j['stopLabel'] as String? ?? '—',
      targetLabel: j['targetLabel'] as String? ?? '—',
      projectedR: j['projectedR'] as String? ?? '—',
      dataFreshness: j['dataFreshness'] as String? ?? 'LIVE',
      reliabilityBoost: (j['reliabilityBoost'] as num?)?.toInt() ?? 0,
      marketAligned: j['marketAligned'] as bool? ?? true,
      lastTickMs: (j['lastTickMs'] as num?)?.toInt() ?? 0,
      putAssist: j['putAssist'] is Map<String, dynamic>
          ? PutAssistAdvisory.fromJson(j['putAssist'] as Map<String, dynamic>)
          : null,
      bearishOps: j['bearishOps'] is Map<String, dynamic>
          ? BearishOperationalOverlay.fromJson(j['bearishOps'] as Map<String, dynamic>)
          : null,
    );
  }
}

class BearishOperationalOverlay {
  const BearishOperationalOverlay({
    this.operationalChip,
    this.premarketChip,
    this.deterioration,
    this.longSuppression,
    this.putAssistGrade,
    this.directionalConflict,
  });

  final String? operationalChip;
  final String? premarketChip;
  final String? deterioration;
  final String? longSuppression;
  final String? putAssistGrade;
  final String? directionalConflict;

  factory BearishOperationalOverlay.fromJson(Map<String, dynamic> j) {
    return BearishOperationalOverlay(
      operationalChip: j['operationalChip'] as String?,
      premarketChip: j['premarketChip'] as String?,
      deterioration: j['deterioration'] as String?,
      longSuppression: j['longSuppression'] as String?,
      putAssistGrade: j['putAssistGrade'] as String?,
      directionalConflict: j['directionalConflict'] as String?,
    );
  }
}

class PutAssistAdvisory {
  const PutAssistAdvisory({
    required this.active,
    required this.bearishBias,
    this.bearishState = '',
    this.breakdownProbability = '',
    this.confidence = '',
    this.badgeLabel,
    this.putAssistGrade,
  });

  final bool active;
  final int bearishBias;
  final String bearishState;
  final String breakdownProbability;
  final String confidence;
  final String? badgeLabel;
  final String? putAssistGrade;

  factory PutAssistAdvisory.fromJson(Map<String, dynamic> j) {
    return PutAssistAdvisory(
      active: j['active'] as bool? ?? false,
      bearishBias: (j['bearishBias'] as num?)?.toInt() ?? 0,
      bearishState: j['bearishState'] as String? ?? '',
      breakdownProbability: j['breakdownProbability'] as String? ?? '',
      confidence: j['confidence'] as String? ?? '',
      badgeLabel: j['badgeLabel'] as String?,
      putAssistGrade: j['putAssistGrade'] as String?,
    );
  }
}
