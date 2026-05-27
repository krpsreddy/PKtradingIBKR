import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/live_trader_snapshot.dart';
import '../../models/runtime_controls.dart';
import '../../models/tier1_snapshot.dart';
import 'dio_client.dart';

class LiveTraderApi {
  LiveTraderApi(this._dio);

  final Dio _dio;

  Future<Tier1Snapshot> tier1() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/live-trader/tier1');
    return Tier1Snapshot.fromJson(r.data ?? {});
  }

  Future<LiveTraderSnapshot> snapshot() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/live-trader/snapshot');
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
}

final liveTraderApiProvider = Provider<LiveTraderApi>(
  (ref) => LiveTraderApi(ref.watch(dioProvider)),
);
