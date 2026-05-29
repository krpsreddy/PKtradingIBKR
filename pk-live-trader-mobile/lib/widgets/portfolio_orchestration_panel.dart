import 'package:flutter/material.dart';

import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../models/portfolio_state.dart';

/// Phase 189 — active / queue / suppressed / replacement sections.
class PortfolioOrchestrationPanel extends StatelessWidget {
  const PortfolioOrchestrationPanel({super.key, required this.state});

  final PortfolioState? state;

  @override
  Widget build(BuildContext context) {
    if (state == null) return const SizedBox.shrink();

    final suppressed = state!.suppressed.isNotEmpty
        ? state!.suppressed
        : [
            ...state!.correlationBlocks,
            ...state!.qualityRejected,
            ...state!.marketRejected,
          ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle('PORTFOLIO'),
        if (state!.activePosition != null) ...[
          const SizedBox(height: 6),
          _ActiveCard(slot: state!.activePosition!),
        ],
        if (state!.queued.isNotEmpty) ...[
          const SizedBox(height: 10),
          const _SectionTitle('QUEUE', color: PkTheme.blue),
          ...state!.queued.take(5).map((s) => _SlotRow(slot: s, accent: PkTheme.blue)),
        ],
        if (state!.replacementCandidates.isNotEmpty) ...[
          const SizedBox(height: 10),
          const _SectionTitle('REPLACEMENT', color: PkTheme.orange),
          ...state!.replacementCandidates.take(3).map(
                (s) => _SlotRow(slot: s, accent: PkTheme.orange, prefix: 'Candidate'),
              ),
        ],
        if (suppressed.isNotEmpty) ...[
          const SizedBox(height: 10),
          const _SectionTitle('SUPPRESSED', color: PkTheme.muted),
          ...suppressed.take(5).map((s) => _SlotRow(slot: s, accent: PkTheme.muted, muted: true)),
        ],
      ],
    );
  }
}

class _ActiveCard extends StatelessWidget {
  const _ActiveCard({required this.slot});

  final ActivePortfolioSlot slot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: PkTheme.green.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: PkTheme.green.withValues(alpha: 0.55)),
        boxShadow: [
          BoxShadow(color: PkTheme.green.withValues(alpha: 0.15), blurRadius: 12),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ACTIVE POSITION', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: PkTheme.green)),
          const SizedBox(height: 4),
          Text(
            '${slot.symbol} — ${formatRegimeLabel(slot.regime)}',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          Text('Lifecycle: ${slot.lifecycle}', style: const TextStyle(fontSize: 11, color: PkTheme.muted)),
          Text('Dominance: ${slot.dominance}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: PkTheme.green)),
          if (slot.holdDurationSec != null)
            Text('Hold: ${slot.holdDurationSec}s', style: const TextStyle(fontSize: 10, color: PkTheme.muted)),
        ],
      ),
    );
  }
}

class _SlotRow extends StatelessWidget {
  const _SlotRow({required this.slot, required this.accent, this.muted = false, this.prefix});

  final PortfolioOpportunitySlot slot;
  final Color accent;
  final bool muted;
  final String? prefix;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${prefix != null ? '$prefix ' : ''}${slot.symbol} — Dom ${slot.dominance}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: muted ? PkTheme.muted : PkTheme.text,
                  ),
                ),
                if (slot.reason.isNotEmpty)
                  Text(slot.reason, style: TextStyle(fontSize: 10, color: muted ? PkTheme.muted : accent)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {this.color = PkTheme.muted});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color, letterSpacing: 1.1),
    );
  }
}
