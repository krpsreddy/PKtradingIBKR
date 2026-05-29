import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/backend_config.dart';
import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../services/polling/broker_repository.dart';
import '../services/polling/live_trader_repository.dart';

class TerminalStatusBar extends ConsumerWidget {
  const TerminalStatusBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(liveTerminalProvider);
    final backend = ref.watch(backendConfigProvider);
    final snap = s.snapshot;
    final market = snap?.market;
    final broker = ref.watch(brokerConnectionProvider).status;
    final ibkr = broker?.connected ?? snap?.paperStatus.ibkrConnected ?? false;
    final ibkrLabel = broker != null
        ? 'IBKR ${ibkr ? broker.mode : 'offline'}'
        : 'IBKR ${ibkr ? 'connected' : 'offline'}';
    final delayed = s.quoteDelayed;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        [
          'PK Mobile Trader',
          '${backend.modeLabel} ${backend.apiBase.replaceFirst('http://', '')}',
          if (market?.emotionLabel != null) formatRegimeLabel(market!.emotionLabel!),
          ibkrLabel,
          if (delayed) 'PRICE DELAYED',
          if (s.error != null) s.error!,
        ].join(' · '),
        style: const TextStyle(fontSize: 11, color: PkTheme.muted),
        maxLines: 2,
      ),
    );
  }
}
