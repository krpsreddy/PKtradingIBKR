import 'package:flutter/material.dart';

import '../core/theme/pk_theme.dart';
import '../models/tradingview_signal.dart';

/// Phase 217 — lightweight TV intelligence card (TV PUSH source).
class TvOpportunityCard extends StatelessWidget {
  const TvOpportunityCard({super.key, required this.signal, this.rank});

  final TradingViewSignal signal;
  final int? rank;

  @override
  Widget build(BuildContext context) {
    final accent = signal.direction.contains('BEAR') || signal.bearishBias >= 50
        ? PkTheme.red
        : PkTheme.green;

    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border(left: BorderSide(color: accent, width: 3)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(signal.symbol,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                if (rank != null) ...[
                  const SizedBox(width: 6),
                  Text('#$rank', style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
                ],
                _chip('TV', PkTheme.blue),
                if (signal.stale) _chip('STALE', PkTheme.orange),
                const Spacer(),
                Text('dom ${signal.dominance}',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${signal.lifecycle} · ${signal.regime} · pers ${signal.persistence} · RVOL ${signal.rvol.toStringAsFixed(1)}x',
              style: const TextStyle(fontSize: 10, color: PkTheme.muted),
            ),
            const SizedBox(height: 2),
            Text(
              'EQ ${signal.executionQuality}'
              '${signal.putGrade != 'NONE' ? ' · PUT ${signal.putGrade}' : ''}'
              '${signal.pmState.isNotEmpty ? ' · ${signal.pmState}' : ''}'
              '${signal.conflictLevel.isNotEmpty ? ' · ${signal.conflictLevel}' : ''}',
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color)),
    );
  }
}
