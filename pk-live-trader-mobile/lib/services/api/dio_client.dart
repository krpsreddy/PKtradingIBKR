import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/backend_config.dart';

final dioProvider = Provider<Dio>((ref) {
  final cfg = ref.watch(backendConfigProvider);
  return Dio(BaseOptions(
    baseUrl: cfg.apiBase,
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 12),
    headers: {'Accept': 'application/json'},
  ));
});
