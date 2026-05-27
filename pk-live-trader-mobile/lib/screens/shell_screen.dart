import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../widgets/backend_mode_switch.dart';
import '../features/monitor/monitor_screen.dart';
import '../features/pnl/pnl_screen.dart';
import '../features/positions/positions_screen.dart';
import '../features/scanner/scanner_screen.dart';
import '../features/trader/trader_screen.dart';

class ShellScreen extends ConsumerStatefulWidget {
  const ShellScreen({super.key});

  @override
  ConsumerState<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends ConsumerState<ShellScreen> {
  int _index = 0;

  static const _tabs = [
    (icon: Icons.bolt, label: 'Trader'),
    (icon: Icons.list, label: 'Scanner'),
    (icon: Icons.account_balance_wallet, label: 'Positions'),
    (icon: Icons.show_chart, label: 'P&L'),
    (icon: Icons.monitor_heart, label: 'Monitor'),
  ];

  static const _pages = [
    TraderScreen(),
    ScannerScreen(),
    PositionsScreen(),
    PnlScreen(),
    MonitorScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PK Live Trader', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        backgroundColor: PkTheme.bg,
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 8),
            child: Center(child: BackendModeSwitch()),
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: PkTheme.panel,
        indicatorColor: PkTheme.green.withValues(alpha: 0.2),
        destinations: _tabs
            .map((t) => NavigationDestination(icon: Icon(t.icon), label: t.label))
            .toList(),
      ),
    );
  }
}
