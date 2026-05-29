import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../core/util/opportunity_accent.dart';
import '../models/ranked_opportunity.dart';
import '../services/polling/live_trader_repository.dart';
import '../services/selection/selected_opportunity_state.dart';

class OpportunityRow extends ConsumerWidget {
  const OpportunityRow({super.key, required this.opp, required this.rank});

  final RankedOpportunity opp;
  final int rank;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quote = ref.watch(symbolQuoteProvider(opp.symbol));
    final focus = ref.watch(selectedOpportunityProvider);
    final isSelected = focus.opportunity?.symbol == opp.symbol;
    final accent = OpportunityAccent.borderColor(opp);
    final pct = quote?.changePercent;
    final up = (pct ?? 0) >= 0;
    final chips = OpportunityAccent.chips(opp);

    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => ref.read(selectedOpportunityNotifierProvider.notifier).selectRanked(opp),
        child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border(
            left: BorderSide(color: accent, width: 3),
            top: isSelected ? BorderSide(color: PkTheme.blue.withValues(alpha: 0.5), width: 1) : BorderSide.none,
            right: isSelected ? BorderSide(color: PkTheme.blue.withValues(alpha: 0.5), width: 1) : BorderSide.none,
            bottom: isSelected ? BorderSide(color: PkTheme.blue.withValues(alpha: 0.5), width: 1) : BorderSide.none,
          ),
          boxShadow: isSelected
              ? [BoxShadow(color: PkTheme.blue.withValues(alpha: 0.15), blurRadius: 6)]
              : null,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          children: [
            Row(
              children: [
                Text(opp.symbol, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                if (rank > 0) ...[
                  const SizedBox(width: 6),
                  Text('#$rank', style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
                ],
                if (isSelected) ...[
                  const SizedBox(width: 6),
                  Icon(Icons.adjust, size: 10, color: PkTheme.blue.withValues(alpha: 0.9)),
                ],
                _chip('IBKR', PkTheme.green.withValues(alpha: 0.85)),
                ...chips.map(_chip),
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
      ),
    );
  }

  static const _mini = TextStyle(fontSize: 10, color: PkTheme.muted);

  static Widget _chip(String label, [Color? colorOverride]) {
    final Color color = colorOverride ??
        (label.contains('CHOP') || label.contains('CONFLICT')
            ? PkTheme.yellow
            : PkTheme.red);
    return Padding(
      padding: const EdgeInsets.only(left: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: color)),
      ),
    );
  }
}
