import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/backend_config.dart';
import '../core/theme/pk_theme.dart';

/// Toggle local (LAN) vs remote (Tailscale) backend without reinstalling.
class BackendModeSwitch extends ConsumerWidget {
  const BackendModeSwitch({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cfg = ref.watch(backendConfigProvider);
    final notifier = ref.read(backendConfigProvider.notifier);

    Future<void> onToggle(bool remote) async {
      final result = await notifier.trySetUseRemote(remote);
      if (!context.mounted) return;
      if (result.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error!, style: const TextStyle(fontSize: 12)),
            backgroundColor: PkTheme.red.withValues(alpha: 0.9),
            duration: const Duration(seconds: 5),
          ),
        );
      } else if (result.info != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.info!, style: const TextStyle(fontSize: 12)),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }

    return Tooltip(
      message: '${cfg.modeLabel}: ${cfg.apiBase}',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (cfg.switching)
            const Padding(
              padding: EdgeInsets.only(right: 6),
              child: SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: PkTheme.green),
              ),
            ),
          Text(
            'Local',
            style: TextStyle(
              fontSize: 11,
              color: cfg.useRemote ? PkTheme.muted : PkTheme.green,
              fontWeight: cfg.useRemote ? FontWeight.normal : FontWeight.w600,
            ),
          ),
          Switch(
            value: cfg.useRemote,
            onChanged: cfg.ready && !cfg.switching ? onToggle : null,
            activeTrackColor: PkTheme.green.withValues(alpha: 0.45),
            activeThumbColor: PkTheme.green,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          Text(
            'Remote',
            style: TextStyle(
              fontSize: 11,
              color: cfg.useRemote ? PkTheme.green : PkTheme.muted,
              fontWeight: cfg.useRemote ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
