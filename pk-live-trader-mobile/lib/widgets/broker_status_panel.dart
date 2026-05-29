import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../models/broker_profile.dart';
import '../services/polling/broker_repository.dart';

/// Compact IBKR broker status + PAPER/LIVE switch (matches web terminal panel).
class BrokerStatusPanel extends ConsumerWidget {
  const BrokerStatusPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = ref.watch(brokerConnectionProvider);
    final status = b.status;
    final connected = status?.connected ?? false;
    final isLive = status?.brokerMode == BrokerMode.live;
    final dotColor = !connected
        ? PkTheme.muted
        : (isLive ? PkTheme.red : PkTheme.green);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: PkTheme.panel,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isLive && connected
              ? PkTheme.red.withValues(alpha: 0.55)
              : PkTheme.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'IBKR STATUS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: PkTheme.muted,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  boxShadow: connected
                      ? [
                          BoxShadow(
                            color: dotColor.withValues(alpha: 0.5),
                            blurRadius: 6,
                          ),
                        ]
                      : null,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                connected ? 'CONNECTED' : 'DISCONNECTED',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (b.switching)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                TextButton(
                  onPressed: b.loading
                      ? null
                      : () => _openSwitchSheet(context, ref),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    foregroundColor: PkTheme.blue,
                  ),
                  child: const Text(
                    'SWITCH',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              'Mode: ${status?.mode ?? '—'}',
              if (status?.profile != null && status!.profile != '—')
                'Profile: ${status.profile}',
              if (status?.latencyMs != null) 'Latency: ${status!.latencyMs}ms',
              if (status != null) 'Subs: ${status.subscriptionCount}',
            ].join(' · '),
            style: TextStyle(
              fontSize: 11,
              color: isLive ? PkTheme.red : PkTheme.muted,
              fontWeight: isLive ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          if (b.error != null) ...[
            const SizedBox(height: 4),
            Text(
              b.error!,
              style: const TextStyle(fontSize: 10, color: PkTheme.red),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  void _openSwitchSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: PkTheme.bg,
      isScrollControlled: true,
      builder: (ctx) => const _BrokerSwitchSheet(),
    );
  }
}

class _BrokerSwitchSheet extends ConsumerStatefulWidget {
  const _BrokerSwitchSheet();

  @override
  ConsumerState<_BrokerSwitchSheet> createState() => _BrokerSwitchSheetState();
}

class _BrokerSwitchSheetState extends ConsumerState<_BrokerSwitchSheet> {
  BrokerProfile? _confirmLive;

  @override
  Widget build(BuildContext context) {
    final b = ref.watch(brokerConnectionProvider);
    final profiles = b.profiles;
    final activeId = b.status?.profileId;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          12,
          16,
          16 + MediaQuery.paddingOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Switch IBKR Connection',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: PkTheme.muted),
                ),
              ],
            ),
            if (_confirmLive != null) ...[
              _LiveConfirmBlock(
                profile: _confirmLive!,
                switching: b.switching,
                onBack: () => setState(() => _confirmLive = null),
                onConfirm: () => _applySwitch(_confirmLive!.id),
              ),
            ] else ...[
              ...profiles.map(
                (p) => _ProfileTile(
                  profile: p,
                  selected: p.id == activeId,
                  disabled: b.switching,
                  onTap: () => _onSelectProfile(p),
                ),
              ),
              if (profiles.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'No broker profiles available',
                    style: TextStyle(color: PkTheme.muted, fontSize: 12),
                  ),
                ),
              if (b.error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    b.error!,
                    style: const TextStyle(color: PkTheme.red, fontSize: 12),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  void _onSelectProfile(BrokerProfile p) {
    if (p.mode == BrokerMode.live) {
      setState(() => _confirmLive = p);
      return;
    }
    _applySwitch(p.id);
  }

  Future<void> _applySwitch(String profileId) async {
    await ref.read(brokerConnectionProvider.notifier).connect(profileId);
    if (!mounted) return;
    final err = ref.read(brokerConnectionProvider).error;
    if (err == null) {
      Navigator.pop(context);
    } else {
      setState(() => _confirmLive = null);
    }
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.profile,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });

  final BrokerProfile profile;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isLive = profile.mode == BrokerMode.live;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: PkTheme.panel,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: disabled ? null : onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: selected
                    ? PkTheme.blue
                    : (isLive ? PkTheme.red.withValues(alpha: 0.4) : PkTheme.border),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.name,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${profile.host}:${profile.port} · client ${profile.clientId}',
                        style: const TextStyle(fontSize: 11, color: PkTheme.muted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isLive
                        ? PkTheme.red.withValues(alpha: 0.15)
                        : PkTheme.green.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: isLive ? PkTheme.red : PkTheme.green,
                    ),
                  ),
                  child: Text(
                    brokerModeLabel(profile.mode),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: isLive ? PkTheme.red : PkTheme.green,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LiveConfirmBlock extends StatelessWidget {
  const _LiveConfirmBlock({
    required this.profile,
    required this.switching,
    required this.onBack,
    required this.onConfirm,
  });

  final BrokerProfile profile;
  final bool switching;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: PkTheme.red.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: PkTheme.red.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: PkTheme.red.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'LIVE',
                style: TextStyle(
                  color: PkTheme.red,
                  fontWeight: FontWeight.w800,
                  fontSize: 11,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'LIVE trading enabled',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            'Connecting to ${profile.name} on port ${profile.port}. '
            'Real account market data and orders may apply.',
            style: const TextStyle(fontSize: 12, color: PkTheme.muted),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: switching ? null : onBack,
                child: const Text('Back'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: switching ? null : onConfirm,
                style: FilledButton.styleFrom(
                  backgroundColor: PkTheme.red.withValues(alpha: 0.2),
                  foregroundColor: PkTheme.red,
                ),
                child: switching
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Connect LIVE'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
