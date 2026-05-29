import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/broker_connection_status.dart';
import '../../models/broker_profile.dart';
import 'dio_client.dart';

class BrokerApi {
  BrokerApi(this._dio);

  final Dio _dio;

  static const _switchTimeout = Duration(seconds: 60);

  Future<List<BrokerProfile>> profiles() async {
    final r = await _dio.get<List<dynamic>>('/api/broker/profiles');
    return (r.data ?? [])
        .whereType<Map<String, dynamic>>()
        .map(BrokerProfile.fromJson)
        .where((p) => p.enabled && p.id.isNotEmpty)
        .toList();
  }

  Future<BrokerConnectionStatus> status() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/broker/status');
    return BrokerConnectionStatus.fromJson(r.data ?? {});
  }

  Future<BrokerConnectionStatus> connect(String profileId) async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/broker/connect/${Uri.encodeComponent(profileId)}',
      data: const {},
      options: Options(
        sendTimeout: _switchTimeout,
        receiveTimeout: _switchTimeout,
      ),
    );
    return _parseConnectResponse(r.data);
  }

  Future<BrokerConnectionStatus> reconnect() async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/broker/reconnect',
      data: const {},
      options: Options(
        sendTimeout: _switchTimeout,
        receiveTimeout: _switchTimeout,
      ),
    );
    return _parseConnectResponse(r.data);
  }

  Future<BrokerConnectionStatus> disconnect() async {
    final r = await _dio.post<Map<String, dynamic>>(
      '/api/broker/disconnect',
      data: const {},
    );
    return BrokerConnectionStatus.fromJson(r.data ?? {});
  }

  BrokerConnectionStatus _parseConnectResponse(Map<String, dynamic>? data) {
    final map = data ?? {};
    if (map['ok'] == false) {
      throw Exception(map['error'] as String? ?? 'Broker switch failed');
    }
    final status = map['status'];
    if (status is Map<String, dynamic>) {
      return BrokerConnectionStatus.fromJson(status);
    }
    throw Exception('Invalid broker connect response');
  }
}

final brokerApiProvider = Provider<BrokerApi>(
  (ref) => BrokerApi(ref.watch(dioProvider)),
);
