import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/pk_theme.dart';
import '../../services/polling/live_trader_repository.dart';
import '../../widgets/control_toggles.dart';
import '../../widgets/dominant_hero_card.dart';
import '../../widgets/opportunity_row.dart';
import '../../widgets/connection_banner.dart';
import '../../widgets/status_bar.dart';

/// Top screen — dominant hero + ranked scanner (Tier 1 + Tier 2 polling).
class TraderScreen extends ConsumerWidget {
  const TraderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(liveTerminalProvider);
    final t1 = s.tier1;
    final ranked = (t1?.topRanked ?? []).take(AppConfig.scannerRowLimit).toList();

    return RefreshIndicator(
      onRefresh: () => ref.read(liveTerminalProvider.notifier).refreshNow(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        children: [
          const TerminalStatusBar(),
          const ConnectionBanner(),
          const ControlToggles(),
          const SizedBox(height: 8),
          DominantHeroCard(opp: t1?.dominant),
          const Padding(
            padding: EdgeInsets.only(top: 12, bottom: 6),
            child: Text('TOP RANKED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
          ),
          if (ranked.isEmpty)
            const Text('No ranked opportunities', style: TextStyle(color: PkTheme.muted, fontSize: 12))
          else
            ...ranked.asMap().entries.map((e) => OpportunityRow(opp: e.value, rank: e.key + 1)),
          if ((t1?.degrading ?? []).isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.only(top: 12, bottom: 6),
              child: Text('DEGRADING', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.orange, letterSpacing: 1.2)),
            ),
            ...t1!.degrading.map((o) => OpportunityRow(opp: o, rank: 0)),
          ],
        ],
      ),
    );
  }
}
