import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/pk_theme.dart';
import 'screens/shell_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: PkLiveTraderApp()));
}

class PkLiveTraderApp extends StatelessWidget {
  const PkLiveTraderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PK Live Trader',
      debugShowCheckedModeBanner: false,
      theme: PkTheme.dark(),
      home: const ShellScreen(),
    );
  }
}
