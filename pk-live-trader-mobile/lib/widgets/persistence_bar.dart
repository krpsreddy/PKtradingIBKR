import 'package:flutter/material.dart';

import '../core/theme/pk_theme.dart';

class PersistenceBar extends StatelessWidget {
  const PersistenceBar({super.key, required this.value, this.max = 100});

  final int value;
  final int max;

  @override
  Widget build(BuildContext context) {
    final pct = (value / max).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Institutional pressure', style: TextStyle(fontSize: 10, color: PkTheme.muted)),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 4,
            backgroundColor: const Color(0xFF21262D),
            color: PkTheme.green,
          ),
        ),
      ],
    );
  }
}
