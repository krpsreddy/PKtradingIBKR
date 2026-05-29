import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../services/selection/selected_opportunity_state.dart';

/// Phase 215 — FOLLOW TOP toggle above hero.
class SymbolFocusHeader extends ConsumerWidget {
  const SymbolFocusHeader({super.key, required this.view});

  final SelectedOpportunityView view;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selection = ref.watch(selectedOpportunityNotifierProvider);
    final opp = view.opportunity;
    final subtitle = view.followTop
        ? 'Following #1 ranked'
        : opp != null
            ? (view.fromBearishList ? 'Inspecting bearish · $opp.symbol' : 'Inspecting · $opp.symbol')
            : 'Manual focus';

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'EXECUTION FOCUS',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: PkTheme.muted, letterSpacing: 1.1),
              ),
              Text(subtitle, style: const TextStyle(fontSize: 11, color: PkTheme.blue)),
            ],
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('FOLLOW TOP', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: PkTheme.muted)),
            const SizedBox(width: 6),
            Switch.adaptive(
              value: selection.followTop,
              onChanged: (v) => ref.read(selectedOpportunityNotifierProvider.notifier).setFollowTop(v),
              activeColor: PkTheme.green,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ],
        ),
      ],
    );
  }
}
