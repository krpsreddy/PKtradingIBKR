import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../services/polling/live_trader_repository.dart';
import 'control_toggles.dart' show confirmKill;

/// Phase 210 — execution-only controls on Trader tab (SCAN / AUTO / KILL).
class ExecutionControlToggles extends ConsumerWidget {
  const ExecutionControlToggles({super.key});

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
