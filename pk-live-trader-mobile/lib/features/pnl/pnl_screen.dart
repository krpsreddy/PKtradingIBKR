import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/pk_theme.dart';
import '../../core/util/formatters.dart';
import '../../services/polling/live_trader_repository.dart';
import '../../services/polling/monitor_repository.dart';

class PnlScreen extends ConsumerWidget {
  const PnlScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pnl = ref.watch(liveTerminalProvider).snapshot?.pnl;
    final analytics = ref.watch(monitorProvider).analytics;
    final quotes = ref.watch(liveTerminalProvider).quotes;
    final positions = ref.watch(liveTerminalProvider).snapshot?.activePositions ?? [];

    double liveUnrealized = 0;
    for (final p in positions) {
      final q = quotes[p.symbol];
      final entry = p.avgEntry;
      final qty = p.quantity ?? 0;
      if (q != null && entry != null && qty > 0) {
        liveUnrealized += (q.price - entry) * qty;
      }
    }

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const Text('LIVE P&L', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        _PnlCell('Unrealized ΣR', formatR(pnl?.unrealizedSumR)),
        _PnlCell('Live unrealized \$', formatUsd(liveUnrealized),
            color: liveUnrealized >= 0 ? PkTheme.green : PkTheme.red),
        _PnlCell('Realized ΣR', formatR(pnl?.realizedSumR)),
        _PnlCell('Avg realized R', formatR(analytics?.avgRealizedR ?? pnl?.avgRealizedR)),
        _PnlCell('Open positions', '${pnl?.openPositions ?? 0}'),
        _PnlCell('Closed today', '${pnl?.closedToday ?? 0}'),
        _PnlCell('Continuation captures', '${pnl?.continuationCaptures ?? 0}'),
        _PnlCell('Closed (all-time)', '${analytics?.closedCount ?? 0}'),
        _PnlCell('Avg MFE R', formatR(analytics?.avgMfeR)),
        _PnlCell('Avg MAE R', formatR(analytics?.avgMaeR)),
        const Padding(
          padding: EdgeInsets.only(top: 12),
          child: Text(
            'Paper execution uses internal simulation with live IBKR marks.',
            style: TextStyle(fontSize: 10, color: PkTheme.muted),
          ),
        ),
      ],
    );
  }
}

class _PnlCell extends StatelessWidget {
  const _PnlCell(this.label, this.value, {this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: PkTheme.muted)),
            Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color ?? PkTheme.text)),
          ],
        ),
      ),
    );
  }
}
