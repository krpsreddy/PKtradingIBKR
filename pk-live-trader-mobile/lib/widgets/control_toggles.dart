import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../services/polling/live_trader_repository.dart';

Future<void> confirmKill(BuildContext context, WidgetRef ref, bool active) async {
  if (active) {
    await ref.read(liveTerminalProvider.notifier).resetKillSwitch();
    return;
  }
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: PkTheme.panel,
      title: const Text('Emergency STOP'),
      content: const Text(
        'Disables scanner and auto execution and attempts to flatten paper positions.',
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('STOP ALL', style: TextStyle(color: PkTheme.red)),
        ),
      ],
    ),
  );
  if (ok == true) {
    await ref.read(liveTerminalProvider.notifier).activateKillSwitch();
  }
}

class ControlToggles extends ConsumerWidget {
  const ControlToggles({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rt = ref.watch(liveTerminalProvider).runtime;
    if (rt == null) return const SizedBox.shrink();
    final repo = ref.read(liveTerminalProvider.notifier);

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        _ToggleChip(
          label: 'SCAN ${rt.scanningEnabled ? 'ON' : 'OFF'}',
          on: rt.scanningEnabled,
          color: PkTheme.green,
          onTap: repo.toggleScanning,
        ),
        _ToggleChip(
          label: 'TELEGRAM ${rt.telegramEnabled ? 'ON' : 'OFF'}',
          on: rt.telegramEnabled,
          color: PkTheme.blue,
          onTap: repo.toggleTelegram,
        ),
        _ToggleChip(
          label: 'AUTO ${rt.paperResearch ? 'PAPER' : 'OFF'}',
          on: rt.paperResearch,
          color: PkTheme.green,
          onTap: repo.toggleAutoExec,
        ),
        _ToggleChip(
          label: rt.killSwitchActive ? 'KILL ON' : 'KILL',
          on: rt.killSwitchActive,
          color: PkTheme.red,
          onTap: () => confirmKill(context, ref, rt.killSwitchActive),
        ),
        _ToggleChip(
          label: rt.backgroundHydrationEnabled
              ? 'HYDRATE ON${rt.backgroundHydrationPending > 0 ? ' (${rt.backgroundHydrationPending})' : ''}'
              : 'HYDRATE OFF',
          on: rt.backgroundHydrationEnabled,
          color: PkTheme.blue,
          onTap: repo.toggleBackgroundHydration,
        ),
      ],
    );
  }
}

class _ToggleChip extends StatelessWidget {
  const _ToggleChip({
    required this.label,
    required this.on,
    required this.color,
    required this.onTap,
  });

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
            boxShadow: on
                ? [BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 8)]
                : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: on ? color : PkTheme.muted,
            ),
          ),
        ),
      ),
    );
  }
}
