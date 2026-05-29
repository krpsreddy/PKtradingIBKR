import 'package:dio/dio.dart';

/// Shared timeouts — evolution backend can exceed 12s on full watchlist scans.
abstract final class ApiOptions {
  static const Duration connect = Duration(seconds: 10);
  static const Duration receive = Duration(seconds: 25);
  static const Duration slowReceive = Duration(seconds: 45);

  static Options slow() => Options(
        receiveTimeout: slowReceive,
        sendTimeout: const Duration(seconds: 20),
      );
}
