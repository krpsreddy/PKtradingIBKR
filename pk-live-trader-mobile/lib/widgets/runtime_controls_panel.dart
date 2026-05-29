import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../services/polling/live_trader_repository.dart';

/// Phase 210 — infrastructure toggles on Monitor tab (not Trader).
class RuntimeControlsPanel extends ConsumerWidget {
  const RuntimeControlsPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rt = ref.watch(liveTerminalProvider).runtime;
    if (rt == null) return const SizedBox.shrink();
    final repo = ref.read(liveTerminalProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'RUNTIME CONTROLS',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: PkTheme.muted, letterSpacing: 1.2),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _Chip(
              label: 'TELEGRAM ${rt.telegramEnabled ? 'ON' : 'OFF'}',
              on: rt.telegramEnabled,
              color: PkTheme.blue,
              onTap: repo.toggleTelegram,
            ),
            _Chip(
              label: rt.backgroundHydrationEnabled
                  ? 'HYDRATE ON${rt.backgroundHydrationPending > 0 ? ' (${rt.backgroundHydrationPending})' : ''}'
                  : 'HYDRATE OFF',
              on: rt.backgroundHydrationEnabled,
              color: PkTheme.blue,
              onTap: repo.toggleBackgroundHydration,
            ),
            _Chip(
              label: rt.putAssistEnabled ? 'PUT ASSIST ON' : 'PUT ASSIST OFF',
              on: rt.putAssistEnabled,
              color: PkTheme.red,
              onTap: repo.togglePutAssist,
            ),
          ],
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.on, required this.color, required this.onTap});

  final String label;
  final bool on;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: PkTheme.panel,
      borderRadius: BorderRadius.circular(6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: on ? color : PkTheme.border),
          ),
          child: Text(
            label,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: on ? color : PkTheme.muted),
          ),
        ),
      ),
    );
  }
}
