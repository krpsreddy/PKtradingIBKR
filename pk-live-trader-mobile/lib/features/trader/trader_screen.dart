import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/pk_theme.dart';
import '../../services/polling/live_trader_repository.dart';
import '../../services/selection/selected_opportunity_state.dart';
import '../../widgets/execution_control_toggles.dart';
import '../../widgets/dominant_hero_card.dart';
import '../../widgets/opportunity_row.dart';
import '../../widgets/bearish_opportunity_card.dart';
import '../../widgets/broker_status_panel.dart';
import '../../widgets/connection_banner.dart';
import '../../widgets/portfolio_orchestration_panel.dart';
import '../../widgets/status_bar.dart';

/// Phase 210 — execution terminal: hero, bullish ranked, bearish PUT assist.
class TraderScreen extends ConsumerWidget {
  const TraderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(liveTerminalProvider);
    final focus = ref.watch(selectedOpportunityProvider);
    final t1 = s.tier1;
    final ranked = (t1?.topRanked ?? []).take(AppConfig.scannerRowLimit).toList();
    final bearish = (s.snapshot?.topBearishOpportunities ?? [])
        .take(AppConfig.topBearishLimit)
        .toList();

    return RefreshIndicator(
      onRefresh: () => ref.read(liveTerminalProvider.notifier).refreshNow(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        children: [
          const TerminalStatusBar(),
          const BrokerStatusPanel(),
          const ConnectionBanner(),
          const ExecutionControlToggles(),
          const SizedBox(height: 8),
          DominantHeroCard(view: focus),
          const SizedBox(height: 8),
          PortfolioOrchestrationPanel(state: s.portfolio),
          const Padding(
            padding: EdgeInsets.only(top: 12, bottom: 6),
            child: Text('TOP RANKED', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2)),
          ),
          if (ranked.isEmpty)
            const Text('No ranked opportunities', style: TextStyle(color: PkTheme.muted, fontSize: 12))
          else
            ...ranked.asMap().entries.map((e) => OpportunityRow(opp: e.value, rank: e.key + 1)),
          Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'TOP BEARISH',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.red.withValues(alpha: 0.9), letterSpacing: 1.2),
                ),
                const Text(
                  'Manual PUT Assist',
                  style: TextStyle(fontSize: 10, color: PkTheme.muted),
                ),
              ],
            ),
          ),
          if (bearish.isEmpty)
            const Text(
              'No A/A+ bearish setups — enable PUT assist or wait for structure',
              style: TextStyle(color: PkTheme.muted, fontSize: 11),
            )
          else
            ...bearish.map((o) => BearishOpportunityCard(opp: o)),
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
