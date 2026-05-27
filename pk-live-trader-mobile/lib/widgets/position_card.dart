import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../models/paper_position.dart';
import '../services/polling/live_trader_repository.dart';

class PositionCard extends ConsumerWidget {
  const PositionCard({super.key, required this.position, this.advisory});

  final PaperPosition position;
  final String? advisory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quote = ref.watch(symbolQuoteProvider(position.symbol));
    final entry = position.avgEntry;
    final qty = position.quantity ?? 0;
    final last = quote?.price;
    double? unrealized;
    double? pct;
    if (last != null && entry != null && entry > 0 && qty > 0) {
      unrealized = (last - entry) * qty;
      pct = ((last - entry) / entry) * 100;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(position.symbol, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(formatPrice(last), style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            Text('${position.status} · ${formatRegimeLabel(position.regime)}',
                style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 10,
              runSpacing: 4,
              children: [
                Text('Entry ${formatPrice(entry)}', style: _d),
                Text('Qty $qty', style: _d),
                if (unrealized != null)
                  Text(
                    'Unreal ${formatUsd(unrealized)} (${formatPct(pct)})',
                    style: TextStyle(fontSize: 11, color: unrealized >= 0 ? PkTheme.green : PkTheme.red),
                  ),
                if (position.realizedR != null) Text('Real ${formatR(position.realizedR)}R', style: _d),
                Text('MFE ${formatR(position.mfeR)}', style: _d),
                Text('MAE ${formatR(position.maeR)}', style: _d),
              ],
            ),
            if ((position.exitSuggestion ?? advisory)?.isNotEmpty == true) ...[
              const SizedBox(height: 6),
              Text(
                position.exitSuggestion ?? advisory!,
                style: const TextStyle(fontSize: 11, color: PkTheme.orange),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static const _d = TextStyle(fontSize: 11, color: PkTheme.muted);
}
