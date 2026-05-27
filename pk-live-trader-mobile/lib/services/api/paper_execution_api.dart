import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/paper_position.dart';
import 'dio_client.dart';

class PaperExecutionApi {
  PaperExecutionApi(this._dio);

  final Dio _dio;

  Future<void> setMode(String mode) async {
    await _dio.put<void>(
      '/api/paper-execution/mode',
      data: {'mode': mode},
    );
  }

  Future<PaperMonitorSnapshot> monitor() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/paper-execution/monitor');
    return PaperMonitorSnapshot.fromJson(r.data ?? {});
  }

  Future<ExecutionAnalytics> analytics() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/paper-execution/analytics');
    return ExecutionAnalytics.fromJson(r.data ?? {});
  }
}

final paperExecutionApiProvider = Provider<PaperExecutionApi>(
  (ref) => PaperExecutionApi(ref.watch(dioProvider)),
);
