import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// Backend URLs — override at build time with dart-define.
class AppConfig {
  AppConfig._();

  static const String localApiBase = String.fromEnvironment(
    'LOCAL_API_BASE',
    defaultValue: 'http://192.168.2.51:8180',
  );

  static const String localLiveApiBase = String.fromEnvironment(
    'LOCAL_LIVE_API_BASE',
    defaultValue: 'http://192.168.2.51:8080',
  );

  /// Android emulator → host machine localhost.
  static const String androidEmulatorApiBase = 'http://10.0.2.2:8180';

  static const String androidEmulatorLiveApiBase = 'http://10.0.2.2:8080';

  static const String remoteApiBase = String.fromEnvironment(
    'REMOTE_API_BASE',
    defaultValue: 'http://100.88.194.48:8180',
  );

  static const String remoteLiveApiBase = String.fromEnvironment(
    'REMOTE_LIVE_API_BASE',
    defaultValue: 'http://100.88.194.48:8080',
  );

  /// Legacy single URL (used as local override when set).
  static const String apiBaseOverride = String.fromEnvironment('API_BASE');

  static String get defaultLocalBase {
    if (apiBaseOverride.isNotEmpty) return apiBaseOverride;
    if (!kIsWeb && Platform.isAndroid) return androidEmulatorApiBase;
    return localApiBase;
  }

  /// Local candidates probed in order (LAN IP, then emulator bridge).
  static List<String> get localProbeBases {
    final bases = <String>[localApiBase];
    if (!kIsWeb && Platform.isAndroid && !bases.contains(androidEmulatorApiBase)) {
      bases.insert(0, androidEmulatorApiBase);
    }
    return bases;
  }

  static const Duration tier1Interval = Duration(seconds: 1);
  static const Duration scannerInterval = Duration(seconds: 4);
  static const Duration snapshotInterval = Duration(seconds: 8);
  static const Duration quotesInterval = Duration(seconds: 1);
  static const Duration marketInterval = Duration(seconds: 15);
  static const Duration tradingViewInterval = Duration(seconds: 5);

  static const int scannerRowLimit = 8;
  static const int tradingViewRowLimit = 10;
  static const int topBearishLimit = 5;
}
