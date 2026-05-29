import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/pk_theme.dart';
import '../../models/tradingview_signal.dart';
import '../../services/polling/tradingview_repository.dart';
import '../../widgets/connection_banner.dart';
import '../../widgets/tv_opportunity_card.dart';

/// Phase 217 — secondary TradingView intelligence (separate from IBKR scanner).
class TradingViewScreen extends ConsumerWidget {
  const TradingViewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tv = ref.watch(tradingViewProvider);
    final feed = tv.feed;

    return RefreshIndicator(
      onRefresh: () => ref.read(tradingViewProvider.notifier).refresh(),
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const ConnectionBanner(),
          const Text(
            'TRADINGVIEW INTELLIGENCE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: PkTheme.muted,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            feed?.health.healthy == true
                ? 'TV PUSH · ${feed!.health.activeSignals} active'
                : 'TV PUSH · waiting for alerts',
            style: const TextStyle(fontSize: 11, color: PkTheme.muted),
          ),
          if (tv.error != null) ...[
            const SizedBox(height: 8),
            Text(tv.error!, style: const TextStyle(color: PkTheme.red, fontSize: 11)),
          ],
          const SizedBox(height: 12),
          if (tv.loading && feed == null)
            const Center(child: CircularProgressIndicator(strokeWidth: 2))
          else if (feed == null)
            const Center(
              child: Text(
                'No TV feed — configure Pine alerts → POST /api/tradingview/webhook',
                style: TextStyle(color: PkTheme.muted, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            )
          else ...[
            _section('TOP BULLISH', feed.topBullish),
            _section('TOP BEARISH', feed.topBearish),
            _section('PUT ASSIST', feed.topPutAssist),
            _section('HIGH CONFLICT', feed.highConflict),
            _section('COLLAPSING', feed.collapsing),
          ],
        ],
      ),
    );
  }

  Widget _section(String title, List<TradingViewSignal> rows) {
    final list = rows.take(AppConfig.tradingViewRowLimit).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Text(title,
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.1)),
        const SizedBox(height: 6),
        if (list.isEmpty)
          const Text('—', style: TextStyle(fontSize: 11, color: PkTheme.muted))
        else
          ...list.asMap().entries.map(
                (e) => TvOpportunityCard(signal: e.value, rank: e.key + 1),
              ),
      ],
    );
  }
}
