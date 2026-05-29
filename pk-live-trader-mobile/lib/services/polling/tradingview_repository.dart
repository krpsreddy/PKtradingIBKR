import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/util/api_errors.dart';
import '../../models/tradingview_signal.dart';
import '../api/tradingview_api.dart';

class TradingViewState {
  const TradingViewState({
    this.feed,
    this.loading = true,
    this.error,
  });

  final TradingViewFeed? feed;
  final bool loading;
  final String? error;
}

class TradingViewRepository extends Notifier<TradingViewState> {
  Timer? _timer;

  @override
  TradingViewState build() {
    ref.onDispose(() => _timer?.cancel());
    _startPolling();
    return const TradingViewState();
  }

  void _startPolling() {
    _timer?.cancel();
    _poll();
    _timer = Timer.periodic(AppConfig.tradingViewInterval, (_) => _poll());
  }

  Future<void> _poll() async {
    try {
      final feed = await ref.read(tradingViewApiProvider).feed();
      state = TradingViewState(feed: feed, loading: false, error: null);
    } catch (e) {
      state = TradingViewState(
        feed: state.feed,
        loading: false,
        error: friendlyApiError(e),
      );
    }
  }

  Future<void> refresh() => _poll();
}

final tradingViewProvider =
    NotifierProvider<TradingViewRepository, TradingViewState>(
  TradingViewRepository.new,
);
