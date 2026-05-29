import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../models/bearish_opportunity.dart';
import '../services/polling/live_trader_repository.dart';
import '../services/selection/selected_opportunity_state.dart';

class BearishOpportunityCard extends ConsumerWidget {
  const BearishOpportunityCard({super.key, required this.opp});

  final BearishOpportunity opp;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quote = ref.watch(symbolQuoteProvider(opp.symbol));
    final focus = ref.watch(selectedOpportunityProvider);
    final isSelected = focus.opportunity?.symbol == opp.symbol;
    final pct = quote?.changePercent;
    final up = (pct ?? 0) >= 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => ref.read(selectedOpportunityNotifierProvider.notifier).selectBearish(opp),
        child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border(
            left: BorderSide(color: PkTheme.red.withValues(alpha: 0.85), width: 3),
            top: isSelected ? BorderSide(color: PkTheme.red.withValues(alpha: 0.45), width: 1) : BorderSide.none,
            right: isSelected ? BorderSide(color: PkTheme.red.withValues(alpha: 0.45), width: 1) : BorderSide.none,
            bottom: isSelected ? BorderSide(color: PkTheme.red.withValues(alpha: 0.45), width: 1) : BorderSide.none,
          ),
          boxShadow: isSelected
              ? [BoxShadow(color: PkTheme.red.withValues(alpha: 0.18), blurRadius: 6)]
              : null,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(opp.symbol, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                          if (isSelected) ...[
                            const SizedBox(width: 6),
                            Icon(Icons.adjust, size: 10, color: PkTheme.red.withValues(alpha: 0.9)),
                          ],
                        ],
                      ),
                      Text(
                        formatRegimeLabel(opp.bearishRegime),
                        style: const TextStyle(fontSize: 10, color: PkTheme.orange),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text('Bias ${opp.bearishBias}', style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
                    Text('Persist ${opp.persistenceSeconds}', style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
                    Text(
                      'Breakdown ${opp.breakdownProbability}%',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: PkTheme.red),
                    ),
                  ],
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(formatPrice(quote?.price), style: TextStyle(fontWeight: FontWeight.w700, color: up ? PkTheme.green : PkTheme.red)),
                    Text(formatPct(pct), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: up ? PkTheme.green : PkTheme.red)),
                    _PutGradeBadge(grade: opp.putGrade),
                  ],
                ),
              ],
            ),
            if (opp.narrative.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                opp.narrative,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10, color: PkTheme.muted, fontStyle: FontStyle.italic),
              ),
            ],
          ],
        ),
      ),
      ),
    );
  }
}

class _PutGradeBadge extends StatelessWidget {
  const _PutGradeBadge({required this.grade});

  final String grade;

  @override
  Widget build(BuildContext context) {
    if (grade.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: PkTheme.red.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: PkTheme.red.withValues(alpha: 0.6)),
      ),
      child: Text('PUT $grade', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: PkTheme.red)),
    );
  }
}
