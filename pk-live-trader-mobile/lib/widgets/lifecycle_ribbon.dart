import 'package:flutter/material.dart';

import '../core/theme/pk_theme.dart';

/// Phase 188 — trade lifecycle progression ribbon.
class LifecycleRibbon extends StatelessWidget {
  const LifecycleRibbon({super.key, required this.activePhase, this.compact = false});

  final String activePhase;
  final bool compact;

  static const _phases = [
    'DEVELOPING',
    'CONFIRMED',
    'PERSISTING',
    'SECOND_LEG',
    'EXTENDED',
    'EXHAUSTING',
    'FAILED',
  ];

  @override
  Widget build(BuildContext context) {
    final active = activePhase.toUpperCase();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _phases.map((p) {
          final on = p == active;
          final color = _phaseColor(p, on);
          return Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: compact ? 5 : 6,
                vertical: compact ? 3 : 4,
              ),
              decoration: BoxDecoration(
                color: on ? color.withValues(alpha: 0.2) : PkTheme.bg,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: on ? color : PkTheme.border),
              ),
              child: Text(
                p.replaceAll('_', ' '),
                style: TextStyle(
                  fontSize: compact ? 7 : 8,
                  fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                  color: on ? color : PkTheme.muted,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Color _phaseColor(String phase, bool on) {
    if (!on) return PkTheme.muted;
    switch (phase) {
      case 'FAILED':
      case 'EXHAUSTING':
        return PkTheme.red;
      case 'EXTENDED':
        return PkTheme.orange;
      case 'SECOND_LEG':
        return PkTheme.yellow;
      case 'CONFIRMED':
      case 'PERSISTING':
        return PkTheme.green;
      default:
        return PkTheme.blue;
    }
  }
}
