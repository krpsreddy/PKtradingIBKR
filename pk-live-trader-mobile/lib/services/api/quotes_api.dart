import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/quote.dart';
import 'dio_client.dart';

class QuotesApi {
  QuotesApi(this._dio);

  final Dio _dio;

  Future<QuoteBatch> fetch(List<String> symbols) async {
    if (symbols.isEmpty) return {};
    final q = symbols.join(',');
    final r = await _dio.get<Map<String, dynamic>>(
      '/api/quotes',
      queryParameters: {'symbols': q},
    );
    final data = r.data ?? {};
    final out = <String, SymbolQuote>{};
    data.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        out[key.toUpperCase()] = SymbolQuote.fromJson(value);
      }
    });
    return out;
  }
}

final quotesApiProvider = Provider<QuotesApi>(
  (ref) => QuotesApi(ref.watch(dioProvider)),
);
