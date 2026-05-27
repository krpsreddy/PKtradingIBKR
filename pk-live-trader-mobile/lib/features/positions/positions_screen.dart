import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/pk_theme.dart';
import '../../services/polling/live_trader_repository.dart';
import '../../widgets/position_card.dart';

class PositionsScreen extends ConsumerWidget {
  const PositionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snap = ref.watch(liveTerminalProvider).snapshot;
    final positions = snap?.activePositions ?? [];
    final advisories = snap?.advisories ?? [];

    String? advisoryFor(String sym) {
      for (final a in advisories) {
        if (a.startsWith(sym)) return a;
      }
      return null;
    }

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const Text('ACTIVE POSITIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        if (positions.isEmpty)
          const Text('No open paper positions', style: TextStyle(color: PkTheme.muted))
        else
          ...positions.map((p) => PositionCard(position: p, advisory: advisoryFor(p.symbol))),
        if (advisories.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(top: 16, bottom: 6),
            child: Text('EXIT ADVISORIES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.orange, letterSpacing: 1.2)),
          ),
          ...advisories.map((a) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(a, style: const TextStyle(fontSize: 12, color: PkTheme.orange)),
              )),
        ],
      ],
    );
  }
}
