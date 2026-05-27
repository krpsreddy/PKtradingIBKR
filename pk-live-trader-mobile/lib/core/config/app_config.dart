/// Backend URLs — override at build time with dart-define.
class AppConfig {
  AppConfig._();

  static const String localApiBase = String.fromEnvironment(
    'LOCAL_API_BASE',
    defaultValue: 'http://192.168.2.51:8180',
  );

  static const String remoteApiBase = String.fromEnvironment(
    'REMOTE_API_BASE',
    defaultValue: 'http://100.88.194.48:8180',
  );

  /// Legacy single URL (used as local override when set).
  static const String apiBaseOverride = String.fromEnvironment('API_BASE');

  static String get defaultLocalBase =>
      apiBaseOverride.isNotEmpty ? apiBaseOverride : localApiBase;

  static const Duration tier1Interval = Duration(seconds: 1);
  static const Duration scannerInterval = Duration(seconds: 4);
  static const Duration snapshotInterval = Duration(seconds: 8);
  static const Duration quotesInterval = Duration(seconds: 1);
  static const Duration marketInterval = Duration(seconds: 15);

  static const int scannerRowLimit = 8;
}
