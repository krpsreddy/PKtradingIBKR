import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/runtime_config.dart';
import '../core/config/runtime_profile_state.dart';
import '../core/theme/pk_theme.dart';

class RuntimeSelector extends ConsumerWidget {
  const RuntimeSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final runtime = ref.watch(runtimeProfileProvider);
    final notifier = ref.read(runtimeProfileProvider.notifier);
    final paper = runtime.selected == TradingRuntime.paper;

    Future<void> select(bool live) async {
      await notifier.setRuntime(live ? TradingRuntime.live : TradingRuntime.paper);
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'PAPER',
          style: TextStyle(
            fontSize: 10,
            fontWeight: paper ? FontWeight.w700 : FontWeight.normal,
            color: paper ? const Color(0xFFE67E22) : PkTheme.muted,
          ),
        ),
        Switch(
          value: !paper,
          onChanged: runtime.loading ? null : (v) => select(v),
          activeTrackColor: PkTheme.red.withValues(alpha: 0.5),
          activeThumbColor: PkTheme.red,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        Text(
          'LIVE',
          style: TextStyle(
            fontSize: 10,
            fontWeight: !paper ? FontWeight.w700 : FontWeight.normal,
            color: !paper ? PkTheme.red : PkTheme.muted,
          ),
        ),
      ],
    );
  }
}
