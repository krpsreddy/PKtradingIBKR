import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/tradingview_signal.dart';
import 'dio_client.dart';

class TradingViewApi {
  TradingViewApi(this._dio);

  final Dio _dio;

  Future<TradingViewFeed> feed() async {
    final r = await _dio.get<Map<String, dynamic>>('/api/tradingview/feed');
    return TradingViewFeed.fromJson(r.data ?? {});
  }
}

final tradingViewApiProvider = Provider<TradingViewApi>(
  (ref) => TradingViewApi(ref.watch(dioProvider)),
);
