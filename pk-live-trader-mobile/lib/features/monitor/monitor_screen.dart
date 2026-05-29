import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/pk_theme.dart';
import '../../models/broker_profile.dart';
import '../../services/polling/broker_repository.dart';
import '../../services/polling/live_trader_repository.dart';
import '../../services/polling/monitor_repository.dart';
import '../../widgets/broker_status_panel.dart';
import '../../widgets/position_card.dart';
import '../../widgets/integrity_badge.dart';
import '../../widgets/runtime_controls_panel.dart';
import '../../widgets/stream_utilization_panel.dart';

/// System health + paper execution + telemetry logs.
class MonitorScreen extends ConsumerWidget {
  const MonitorScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mon = ref.watch(monitorProvider);
    final paper = ref.watch(liveTerminalProvider).snapshot?.paperStatus;
    final rt = ref.watch(liveTerminalProvider).runtime;
    final broker = ref.watch(brokerConnectionProvider).status;
    final ops = mon.ops;

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const BrokerStatusPanel(),
        const SizedBox(height: 12),
        const RuntimeControlsPanel(),
        if (mon.streamState != null) ...[
          StreamUtilizationPanel(state: mon.streamState!),
          const SizedBox(height: 12),
        ],
        const Text('SYSTEM OPS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        if (ops != null) ...[
          Row(
            children: [
              const Text('Data integrity', style: TextStyle(fontSize: 11, color: PkTheme.muted)),
              const Spacer(),
              IntegrityBadge(state: ops.dataIntegrityState, score: ops.dataIntegrityScore),
            ],
          ),
          const SizedBox(height: 6),
          _InfoRow('Quote feed', ops.quoteFreshness),
          _InfoRow('IBKR phase', ops.ibkrPhase),
          _InfoRow('Verified streams', '${ops.verifiedActiveStreams} (reg ${ops.registrySubscriptions})'),
          if (ops.lastTickAgeMs >= 0)
            _InfoRow('Last tick age', '${(ops.lastTickAgeMs / 1000).toStringAsFixed(0)}s'),
          if (ops.staleStreamCount > 0 || ops.deadStreamCount > 0)
            _InfoRow('Stale / dead', '${ops.staleStreamCount} / ${ops.deadStreamCount}'),
          if (ops.reconnectAttempts > 0)
            _InfoRow('Stream recoveries', '${ops.reconnectAttempts}'),
          _InfoRow('Scanner', ops.scannerEnabled ? 'ON · gen ${ops.scannerGeneration}' : 'OFF'),
          _InfoRow('Scan age', '${ops.scannerAgeMs}ms'),
          _InfoRow('IBKR streaming', ops.ibkrStreaming ? 'ACTIVE' : '—'),
          _InfoRow('Data integrity', '${ops.dataIntegrityState} (${ops.dataIntegrityScore})'),
          _InfoRow('Telemetry', '${ops.telemetryLogCount} records'),
          _InfoRow('Open paper', '${ops.openPaperPositions}'),
          if (ops.brokerLatencyMs != null) _InfoRow('Broker latency', '${ops.brokerLatencyMs}ms'),
          ...ops.safetyMessages.map((m) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('⚠ $m', style: const TextStyle(fontSize: 11, color: PkTheme.orange)),
              )),
        ],
        const SizedBox(height: 12),
        const Text('EXECUTION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        _InfoRow('Mode', rt?.executionMode ?? '—'),
        _InfoRow(
          'IBKR',
          broker != null
              ? '${broker.connected ? 'Connected' : 'Offline'} · ${broker.mode}'
              : (paper?.ibkrConnected == true ? 'Connected' : 'Offline'),
        ),
        if (broker != null && broker.brokerMode == BrokerMode.live)
          const _InfoRow('LIVE account', 'Active'),
        _InfoRow('Paper safety', paper?.safetyAllowed == true ? 'OK' : (paper?.safetyReason ?? 'Blocked')),
        _InfoRow('Auto exec', rt?.autoExecutionEnabled == true ? 'ON · 1 share' : 'OFF'),
        _InfoRow('Kill switch', rt?.killSwitchActive == true ? 'ACTIVE' : 'off'),
        const SizedBox(height: 12),
        if (mon.loading)
          const Center(child: CircularProgressIndicator(strokeWidth: 2))
        else if (mon.error != null)
          Text(mon.error!, style: const TextStyle(color: PkTheme.red))
        else ...[
          if (ops != null && ops.recentTelemetry.isNotEmpty) ...[
            const Text('TELEMETRY LOG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
            const SizedBox(height: 6),
            ...ops.recentTelemetry.take(6).map(
                  (t) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '${t.symbol} · ${t.executionQuality} · ${t.entryReason}${t.exitReason != null ? ' → ${t.exitReason}' : ''}${t.realizedR != null ? ' · ${t.realizedR!.toStringAsFixed(2)}R' : ''}',
                      style: const TextStyle(fontSize: 10, color: PkTheme.muted),
                    ),
                  ),
                ),
            const SizedBox(height: 12),
          ],
          Text('Active: ${mon.snapshot?.activePositions.length ?? 0}', style: const TextStyle(fontSize: 12)),
          ...(mon.snapshot?.activePositions ?? []).map((p) => PositionCard(position: p)),
        ],
        TextButton(
          onPressed: () => ref.read(liveTerminalProvider.notifier).testTelegram(),
          child: const Text('Test Telegram alert'),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.k, this.v);

  final String k;
  final String v;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: const TextStyle(fontSize: 12, color: PkTheme.muted)),
          Flexible(child: Text(v, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), textAlign: TextAlign.end)),
        ],
      ),
    );
  }
}
