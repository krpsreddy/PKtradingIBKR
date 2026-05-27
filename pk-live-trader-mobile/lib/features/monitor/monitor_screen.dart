import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/pk_theme.dart';
import '../../services/polling/live_trader_repository.dart';
import '../../services/polling/monitor_repository.dart';
import '../../widgets/position_card.dart';

/// Execution monitor — paper orders/positions + IBKR connection status.
class MonitorScreen extends ConsumerWidget {
  const MonitorScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mon = ref.watch(monitorProvider);
    final paper = ref.watch(liveTerminalProvider).snapshot?.paperStatus;
    final rt = ref.watch(liveTerminalProvider).runtime;

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const Text('EXECUTION MONITOR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        _InfoRow('Mode', rt?.executionMode ?? '—'),
        _InfoRow('IBKR', paper?.ibkrConnected == true ? 'Connected' : 'Offline'),
        _InfoRow('Paper safety', paper?.safetyAllowed == true ? 'OK' : (paper?.safetyReason ?? 'Blocked')),
        _InfoRow('Auto exec', rt?.autoExecutionEnabled == true ? 'ON (1 share probes)' : 'OFF'),
        const SizedBox(height: 12),
        if (mon.loading)
          const Center(child: CircularProgressIndicator(strokeWidth: 2))
        else if (mon.error != null)
          Text(mon.error!, style: const TextStyle(color: PkTheme.red))
        else ...[
          Text('Active: ${mon.snapshot?.activePositions.length ?? 0}', style: const TextStyle(fontSize: 12)),
          ...(mon.snapshot?.activePositions ?? []).map((p) => PositionCard(position: p)),
        ],
        const Padding(
          padding: EdgeInsets.only(top: 12),
          child: Text(
            'Telegram: DOMINANT_NOW, EMERGING_FAST, PAPER_ENTRY, SECOND_LEG, EXIT_WARNING — cooldowns on backend.',
            style: TextStyle(fontSize: 10, color: PkTheme.muted),
          ),
        ),
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
          Text(v, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
