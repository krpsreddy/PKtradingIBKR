import 'dart:async';

import 'package:dio/dio.dart';

/// True for timeouts / connection blips where keeping last good UI state is OK.
bool isTransientApiError(Object e) {
  if (e is TimeoutException) return true;
  if (e is DioException) {
    return e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.sendTimeout;
  }
  return false;
}

String friendlyApiError(Object e) {
  if (e is DioException && e.type == DioExceptionType.receiveTimeout) {
    return 'Server slow — retrying';
  }
  if (e is TimeoutException) {
    return 'Connection timed out';
  }
  if (e is DioException) {
    return e.message ?? e.toString();
  }
  return e.toString().replaceFirst('Exception: ', '');
}
