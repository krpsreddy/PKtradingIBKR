import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/backend_config.dart';
import '../core/theme/pk_theme.dart';
import '../services/polling/live_trader_repository.dart';
import '../services/polling/monitor_repository.dart';

class ConnectionBanner extends ConsumerWidget {
  const ConnectionBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final terminal = ref.watch(liveTerminalProvider);
    final backend = ref.watch(backendConfigProvider);

    final hasData = terminal.runtime != null || terminal.tier1 != null;

    if (backend.switching) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: PkTheme.green),
            ),
            SizedBox(width: 10),
            Text('Switching endpoint…', style: TextStyle(fontSize: 12, color: PkTheme.muted)),
          ],
        ),
      );
    }

    if (terminal.loading && !hasData) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: PkTheme.green),
            ),
            SizedBox(width: 10),
            Text('Connecting…', style: TextStyle(fontSize: 12, color: PkTheme.muted)),
          ],
        ),
      );
    }

    final msg = backend.lastError ?? terminal.error;
    if (msg == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: PkTheme.red.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.warning_amber_rounded, color: PkTheme.red, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  msg,
                  style: const TextStyle(fontSize: 11, color: PkTheme.red, height: 1.35),
                ),
              ),
              TextButton(
                onPressed: () async {
                  await ref.read(liveTerminalProvider.notifier).reconnect();
                  await ref.read(monitorProvider.notifier).reconnect();
                },
                child: const Text('Retry', style: TextStyle(fontSize: 11)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
