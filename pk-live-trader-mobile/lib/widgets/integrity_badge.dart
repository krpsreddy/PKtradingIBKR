import 'package:flutter/material.dart';

import '../core/theme/pk_theme.dart';

/// Phase 205 — color-coded data integrity state (monitor only).
class IntegrityBadge extends StatelessWidget {
  const IntegrityBadge({
    super.key,
    required this.state,
    required this.score,
    this.compact = false,
  });

  final String state;
  final int score;
  final bool compact;

  Color get _color {
    switch (state.toUpperCase()) {
      case 'LIVE':
        return PkTheme.green;
      case 'DELAYED':
        return PkTheme.orange;
      case 'RECOVERING':
        return Colors.amber;
      case 'DEGRADED':
        return PkTheme.orange;
      case 'STALE':
      case 'DISCONNECTED':
        return PkTheme.red;
      default:
        return PkTheme.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = compact ? state : '$state · $score';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: _color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: compact ? 10 : 11, fontWeight: FontWeight.w600, color: _color),
      ),
    );
  }
}
