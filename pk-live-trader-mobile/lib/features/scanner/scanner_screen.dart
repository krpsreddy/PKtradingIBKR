import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/pk_theme.dart';
import '../../models/ranked_opportunity.dart';
import '../../services/polling/live_trader_repository.dart';
import '../../widgets/connection_banner.dart';
import '../../widgets/opportunity_row.dart';

/// Live scanner — dominance-ranked rows only (no research UI).
class ScannerScreen extends ConsumerWidget {
  const ScannerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final terminal = ref.watch(liveTerminalProvider);
    final t1 = terminal.liveScan ?? terminal.tier1;
    final all = <RankedOpportunity>[
      if (t1?.dominant != null) t1!.dominant!,
      ...?t1?.topRanked,
    ];
    final seen = <String>{};
    final rows = <RankedOpportunity>[];
    for (final o in all) {
      if (seen.add(o.symbol)) rows.add(o);
    }
    rows.sort((a, b) => b.dominanceScore.compareTo(a.dominanceScore));
    final list = rows.take(AppConfig.scannerRowLimit).toList();

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const ConnectionBanner(),
        const Text('LIVE SCANNER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        if (list.isEmpty)
          Center(
            child: Text(
              terminal.runtime?.scanningEnabled == false
                  ? 'Scanning OFF — enable SCAN on Trader tab'
                  : terminal.error != null
                      ? 'Cannot reach backend'
                      : 'Scanner idle — waiting for live rankings',
              style: const TextStyle(color: PkTheme.muted),
              textAlign: TextAlign.center,
            ),
          )
        else
          ...list.asMap().entries.map((e) => OpportunityRow(opp: e.value, rank: e.key + 1)),
      ],
    );
  }
}
