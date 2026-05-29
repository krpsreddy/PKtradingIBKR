import 'package:dio/dio.dart';

import '../../models/runtime_profile.dart';

class RuntimeApi {
  RuntimeApi(this._dio);

  final Dio _dio;

  Future<RuntimeProfile> fetchProfile() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/runtime/profile');
    return RuntimeProfile.fromJson(res.data ?? {});
  }
}
