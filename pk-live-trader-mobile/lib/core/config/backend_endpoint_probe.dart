import 'package:dio/dio.dart';

/// Quick reachability check before switching API base URL.
Future<String?> probeBackend(String apiBase) async {
  final dio = Dio(BaseOptions(
    baseUrl: apiBase,
    connectTimeout: const Duration(seconds: 6),
    receiveTimeout: const Duration(seconds: 10),
    headers: {'Accept': 'application/json'},
  ));
  try {
    final r = await dio.get<Map<String, dynamic>>('/api/live-trader/tier1');
    if (r.statusCode == 200 && r.data != null) return null;
    return 'HTTP ${r.statusCode}';
  } on DioException catch (e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Timeout — check network / Tailscale';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot connect to $apiBase';
    }
    return e.message ?? e.type.name;
  } catch (e) {
    return e.toString();
  }
}
