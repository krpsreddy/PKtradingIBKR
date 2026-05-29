import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

import 'app_config.dart';

/// Phase 221 — dual runtime endpoints (isolated backends).
enum TradingRuntime { paper, live }

class RuntimeConfig {
  RuntimeConfig._();

  static const int paperPort = 8180;
  static const int livePort = 8080;

  static const String _hostOverride = String.fromEnvironment('PK_HOST');

  static String get defaultHost {
    if (_hostOverride.isNotEmpty) return _hostOverride;
    if (!kIsWeb && Platform.isAndroid) return '10.0.2.2';
    return '127.0.0.1';
  }

  static String localBaseFor(TradingRuntime runtime, {bool androidEmulator = false}) {
    if (androidEmulator) {
      return runtime == TradingRuntime.paper
          ? AppConfig.androidEmulatorApiBase
          : AppConfig.androidEmulatorLiveApiBase;
    }
    final host = AppConfig.localApiBase.contains('://')
        ? AppConfig.localApiBase.split('://').last.split(':').first
        : defaultHost;
    final port = runtime == TradingRuntime.paper ? paperPort : livePort;
    return 'http://$host:$port';
  }

  static String baseUrlFor(TradingRuntime runtime) {
    if (!kIsWeb && Platform.isAndroid) {
      return localBaseFor(runtime, androidEmulator: true);
    }
    return localBaseFor(runtime);
  }

  static String remoteBaseFor(TradingRuntime runtime) {
    return runtime == TradingRuntime.paper
        ? AppConfig.remoteApiBase
        : AppConfig.remoteLiveApiBase;
  }

  /// Android → paper; iOS → live (physical device use PK_HOST=LAN IP).
  static TradingRuntime platformDefault() {
    if (kIsWeb) return TradingRuntime.paper;
    if (Platform.isIOS) return TradingRuntime.live;
    return TradingRuntime.paper;
  }
}
