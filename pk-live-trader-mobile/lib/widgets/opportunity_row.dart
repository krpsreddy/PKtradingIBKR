import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../models/ranked_opportunity.dart';
import '../services/polling/live_trader_repository.dart';

class OpportunityRow extends ConsumerWidget {
  const OpportunityRow({super.key, required this.opp, required this.rank});

  final RankedOpportunity opp;
  final int rank;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quote = ref.watch(symbolQuoteProvider(opp.symbol));
    final tone = PkTheme.toneColor(opp.tone);
    final pct = quote?.changePercent;
    final up = (pct ?? 0) >= 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border(left: BorderSide(color: tone, width: 3)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          children: [
            Row(
              children: [
                Text(opp.symbol, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(width: 6),
                Text('#$rank', style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
                const Spacer(),
                Text(formatPrice(quote?.price), style: TextStyle(fontWeight: FontWeight.w700, color: up ? PkTheme.green : PkTheme.red)),
                const SizedBox(width: 8),
                Text(formatPct(pct), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: up ? PkTheme.green : PkTheme.red)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text('C${opp.conviction}', style: _mini),
                Text('P${opp.persistenceSeconds}s', style: _mini),
                Text('V${opp.convictionVelocity >= 0 ? '+' : ''}${opp.convictionVelocity}', style: _mini),
                Text('D${opp.dominanceScore}', style: _mini),
                const Spacer(),
                Text(
                  opp.maturityState,
                  style: TextStyle(fontSize: 9, color: PkTheme.lifecycleColor(opp.maturityState)),
                ),
              ],
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(formatRegimeLabel(opp.regime), style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
            ),
          ],
        ),
      ),
    );
  }

  static const _mini = TextStyle(fontSize: 10, color: PkTheme.muted);
}
