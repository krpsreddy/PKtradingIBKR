import 'package:flutter/material.dart';

import '../core/theme/pk_theme.dart';
import '../models/stream_state.dart';

/// Phase 194/216 — IBKR dynamic stream allocation + tick verification (Monitor tab).
class StreamUtilizationPanel extends StatelessWidget {
  const StreamUtilizationPanel({super.key, required this.state});

  final StreamState state;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'STREAM UTILIZATION',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: PkTheme.muted,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Verified realtime: ${state.realtimeUsed}/${state.realtimeMax}',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
        Text(
          'Registry subs: ${state.registrySubscriptions} · phase ${state.ibkrPhase}',
          style: const TextStyle(fontSize: 10, color: PkTheme.muted),
        ),
        if (state.streamHealthScore > 0)
          Text(
            'Health ${state.streamHealthScore}% · stale ${state.staleStreams.length} · dead ${state.deadStreams.length}',
            style: const TextStyle(fontSize: 10, color: PkTheme.muted),
          ),
        if (!state.dynamicEnabled)
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text('Static subscribeLive mode', style: TextStyle(fontSize: 10, color: PkTheme.muted)),
          ),
        const SizedBox(height: 8),
        _TierSection(title: 'Realtime (tick-verified)', rows: state.realtime.take(12).toList()),
        const SizedBox(height: 8),
        _TierSection(title: 'Snapshot', rows: state.snapshot.take(8).toList()),
        const SizedBox(height: 8),
        _TierSection(title: 'Dormant', rows: state.dormant.take(6).toList(), compact: true),
      ],
    );
  }
}

class _TierSection extends StatelessWidget {
  const _TierSection({
    required this.title,
    required this.rows,
    this.compact = false,
  });

  final String title;
  final List<StreamSymbolRow> rows;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: PkTheme.muted)),
        const SizedBox(height: 4),
        if (rows.isEmpty)
          const Text('—', style: TextStyle(fontSize: 11, color: PkTheme.muted))
        else
          ...rows.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Text(
                compact
                    ? r.symbol
                    : '${r.symbol} · ${r.tickHealth}${r.dominanceScore > 0 ? ' · dom ${r.dominanceScore}' : ''}',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
              ),
            ),
          ),
      ],
    );
  }
}
