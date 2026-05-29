import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/runtime_config.dart';
import '../core/config/runtime_profile_state.dart';
import '../core/theme/pk_theme.dart';

class RuntimeBanner extends ConsumerWidget {
  const RuntimeBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final runtime = ref.watch(runtimeProfileProvider);
    final isPaper = runtime.selected == TradingRuntime.paper;
    final bg = isPaper
        ? const Color(0xFF1A3A5C)
        : PkTheme.red.withValues(alpha: 0.35);
    final border = isPaper ? const Color(0xFFE67E22) : PkTheme.red;
    final text = runtime.bannerTitle;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: border, width: 1.2),
          ),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
              color: isPaper ? const Color(0xFFFFD59A) : Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
