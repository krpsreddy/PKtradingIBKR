import 'package:flutter/material.dart';

/// Institutional dark terminal theme (matches React live-trader).
class PkTheme {
  PkTheme._();

  static const Color bg = Color(0xFF0D1117);
  static const Color panel = Color(0xFF161B22);
  static const Color border = Color(0xFF30363D);
  static const Color text = Color(0xFFE6EDF3);
  static const Color muted = Color(0xFF8B949E);
  static const Color green = Color(0xFF3FB950);
  static const Color blue = Color(0xFF58A6FF);
  static const Color yellow = Color(0xFFD29922);
  static const Color orange = Color(0xFFDB6D28);
  static const Color red = Color(0xFFF85149);

  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: bg,
      colorScheme: const ColorScheme.dark(
        surface: panel,
        primary: green,
        secondary: blue,
        error: red,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bg,
        foregroundColor: text,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: panel,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: border),
        ),
      ),
      dividerColor: border,
      textTheme: base.textTheme.apply(
        bodyColor: text,
        displayColor: text,
      ),
    );
  }

  static Color toneColor(String tone) {
    switch (tone.toUpperCase()) {
      case 'GREEN':
        return green;
      case 'YELLOW':
        return yellow;
      case 'ORANGE':
        return orange;
      case 'RED':
        return red;
      default:
        return muted;
    }
  }

  static Color lifecycleColor(String lifecycle) {
    switch (lifecycle.toUpperCase()) {
      case 'CONFIRMED':
        return green;
      case 'EXTENDED':
        return orange;
      case 'EXHAUSTING':
      case 'FAILED':
        return red;
      case 'CONFIRMING':
        return yellow;
      default:
        return blue;
    }
  }
}
