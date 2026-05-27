import 'paper_position.dart';
import 'runtime_controls.dart';
import 'tier1_snapshot.dart';

class MarketHeartbeat {
  const MarketHeartbeat({this.emotionLabel, this.sessionMode});

  final String? emotionLabel;
  final String? sessionMode;

  factory MarketHeartbeat.fromJson(Map<String, dynamic>? j) {
    if (j == null) return const MarketHeartbeat();
    String? emotion;
    final em = j['marketEmotion'];
    if (em is String) {
      emotion = em;
    } else if (em is Map) {
      emotion = em['label'] as String?;
    }
    return MarketHeartbeat(
      emotionLabel: emotion,
      sessionMode: j['sessionMode'] as String?,
    );
  }
}

class PaperStatus {
  const PaperStatus({
    required this.mode,
    required this.ibkrConnected,
    this.safetyAllowed = true,
    this.safetyReason,
  });

  final String mode;
  final bool ibkrConnected;
  final bool safetyAllowed;
  final String? safetyReason;

  factory PaperStatus.fromJson(Map<String, dynamic>? j) {
    if (j == null) {
      return const PaperStatus(mode: 'OFF', ibkrConnected: false);
    }
    final safety = j['safety'];
    return PaperStatus(
      mode: j['mode'] as String? ?? 'OFF',
      ibkrConnected: j['ibkrConnected'] as bool? ?? false,
      safetyAllowed: safety is Map ? safety['allowed'] as bool? ?? true : true,
      safetyReason: safety is Map ? safety['reason'] as String? : null,
    );
  }
}

class LiveTraderSnapshot {
  const LiveTraderSnapshot({
    required this.tier1,
    required this.market,
    required this.paperStatus,
    required this.activePositions,
    required this.pnl,
    required this.advisories,
    required this.runtime,
  });

  final Tier1Snapshot tier1;
  final MarketHeartbeat market;
  final PaperStatus paperStatus;
  final List<PaperPosition> activePositions;
  final PnlSummary pnl;
  final List<String> advisories;
  final RuntimeControls runtime;

  factory LiveTraderSnapshot.fromJson(Map<String, dynamic> j) {
    List<PaperPosition> pos(dynamic raw) {
      if (raw is! List) return const [];
      return raw
          .whereType<Map<String, dynamic>>()
          .map(PaperPosition.fromJson)
          .toList();
    }

    List<String> adv(dynamic raw) {
      if (raw is! List) return const [];
      return raw.map((e) => e.toString()).toList();
    }

    return LiveTraderSnapshot(
      tier1: Tier1Snapshot.fromJson(
          j['tier1'] as Map<String, dynamic>? ?? {}),
      market: MarketHeartbeat.fromJson(
          j['market'] as Map<String, dynamic>?),
      paperStatus: PaperStatus.fromJson(
          j['paperStatus'] as Map<String, dynamic>?),
      activePositions: pos(j['activePositions']),
      pnl: PnlSummary.fromJson(
          j['pnl'] as Map<String, dynamic>? ?? {}),
      advisories: adv(j['advisories']),
      runtime: RuntimeControls.fromJson(
          j['runtime'] as Map<String, dynamic>? ?? {}),
    );
  }
}
