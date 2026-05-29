import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/backend_config.dart';
import 'api_options.dart';

final dioProvider = Provider<Dio>((ref) {
  final cfg = ref.watch(backendConfigProvider);
  return Dio(BaseOptions(
    baseUrl: cfg.apiBase,
    connectTimeout: ApiOptions.connect,
    receiveTimeout: ApiOptions.receive,
    headers: {'Accept': 'application/json'},
  ));
});
