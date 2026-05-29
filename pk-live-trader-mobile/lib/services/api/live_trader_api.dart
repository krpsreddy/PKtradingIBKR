import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/live_trader_snapshot.dart';
import '../../models/operational_monitor.dart';
import '../../models/portfolio_state.dart';
import '../../models/stream_state.dart';
import '../../models/runtime_controls.dart';
import '../../models/tier1_snapshot.dart';
import 'api_options.dart';
import 'dio_client.dart';

class LiveTraderApi {
  LiveTraderApi(this._dio);

  final Dio _dio;

  Future<Tier1Snapshot> tier1() async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/live-trader/tier1',
      options: ApiOptions.slow(),
    );
    return Tier1Snapshot.fromJson(r.data ?? {});
  }

  /// Phase 187 — realtime live scanner rankings (mobile scanner tab).
  Future<Tier1Snapshot> liveScan({int limit = 8}) async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/live-trader/live-scan',
      queryParameters: {'limit': limit},
      options: ApiOptions.slow(),
    );
    return Tier1Snapshot.fromJson(r.data ?? {});
  }

  Future<LiveTraderSnapshot> snapshot() async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/live-trader/snapshot',
      options: ApiOptions.slow(),
    );
    return LiveTraderSnapshot.fromJson(r.data ?? {});
  }

  Future<RuntimeControls> runtime() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/live-trader/runtime');
    return RuntimeControls.fromJson(r.data ?? {});
  }

  Future<RuntimeControls> putRuntime(RuntimeControls patch) async {
    final r = await _dio.put<Map<String, dynamic>>(
      '/api/live-trader/runtime',
      data: patch.toPatchJson(),
    );
    return RuntimeControls.fromJson(r.data ?? {});
  }

  Future<void> testTelegram() async {
    await _dio.post<void>('/api/live-trader/telegram/test');
  }

  Future<PortfolioState> portfolioState() async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/live-trader/portfolio-state',
      options: ApiOptions.slow(),
    );
    return PortfolioState.fromJson(r.data ?? {});
  }

  Future<OperationalMonitor> ops() async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/live-trader/ops',
      options: ApiOptions.slow(),
    );
    return OperationalMonitor.fromJson(r.data ?? {});
  }

  Future<StreamState> streamState() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/live-trader/stream-state');
    return StreamState.fromJson(r.data ?? {});
  }

  Future<void> killSwitch() async {
    await _dio.post<void>('/api/live-trader/kill-switch');
  }

  Future<void> resetKillSwitch() async {
    await _dio.post<void>('/api/live-trader/kill-switch/reset');
  }
}

final liveTraderApiProvider = Provider<LiveTraderApi>(
  (ref) => LiveTraderApi(ref.watch(dioProvider)),
);
