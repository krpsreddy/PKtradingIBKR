import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../models/quote.dart';
import '../models/ranked_opportunity.dart';
import '../services/polling/live_trader_repository.dart';
import 'persistence_bar.dart';

class DominantHeroCard extends ConsumerWidget {
  const DominantHeroCard({super.key, this.opp});

  final RankedOpportunity? opp;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (opp == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('—', style: Theme.of(context).textTheme.headlineMedium),
              const Text('Scanning idle', style: TextStyle(color: PkTheme.muted, fontSize: 12)),
            ],
          ),
        ),
      );
    }

    final quote = ref.watch(symbolQuoteProvider(opp!.symbol));
    final tone = PkTheme.toneColor(opp!.tone);
    final lifecycle = PkTheme.lifecycleColor(opp!.maturityState);
    final why = opp!.whyNow.take(2).join(' · ');

    return Card(
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border(left: BorderSide(color: tone, width: 3)),
          boxShadow: [
            BoxShadow(color: tone.withValues(alpha: 0.2), blurRadius: 20),
          ],
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    formatRegimeLabel(opp!.regime),
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: PkTheme.blue),
                  ),
                ),
                if (opp!.emergingFast)
                  const _Badge('EMERGING', PkTheme.yellow),
                if (opp!.dominanceScore >= 72)
                  const _Badge('DOMINANT', PkTheme.green),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(opp!.symbol, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
                const Spacer(),
                _PriceBlock(quote: quote),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _Metric('Conv', '${opp!.conviction}', tone),
                _Metric('Dom', '${opp!.dominanceScore}', PkTheme.green),
                _Metric('Persist', '${opp!.persistenceSeconds}s', PkTheme.blue),
                _Metric(
                  'Vel',
                  '${opp!.convictionVelocity > 0 ? '+' : ''}${opp!.convictionVelocity}',
                  opp!.convictionVelocity >= 0 ? PkTheme.green : PkTheme.red,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: lifecycle.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                opp!.maturityState,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: lifecycle),
              ),
            ),
            const SizedBox(height: 8),
            PersistenceBar(value: opp!.institutionalPressure),
            if (why.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(why, style: const TextStyle(fontSize: 11, color: PkTheme.yellow)),
            ],
            if (opp!.entryZoneLabel.isNotEmpty)
              Text(opp!.entryZoneLabel, style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
          ],
        ),
      ),
    );
  }
}

class _PriceBlock extends StatelessWidget {
  const _PriceBlock({this.quote});

  final SymbolQuote? quote;

  @override
  Widget build(BuildContext context) {
    final pct = quote?.changePercent;
    final up = (pct ?? 0) >= 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          formatPrice(quote?.price),
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: quote == null ? PkTheme.muted : (up ? PkTheme.green : PkTheme.red),
          ),
        ),
        Text(formatPct(pct), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: up ? PkTheme.green : PkTheme.red)),
        if (quote?.stale == true)
          Container(
            margin: const EdgeInsets.only(top: 4),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            color: PkTheme.yellow,
            child: const Text('DELAYED', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.black)),
          ),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.color);

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 4),
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: PkTheme.bg,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 9, color: PkTheme.muted)),
            Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text, this.color);

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color)),
    );
  }
}
