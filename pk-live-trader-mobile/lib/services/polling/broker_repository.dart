import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/backend_config.dart';
import '../../models/broker_connection_status.dart';
import '../../models/broker_profile.dart';
import '../api/broker_api.dart';
import 'live_trader_repository.dart';

class BrokerUiState {
  const BrokerUiState({
    this.status,
    this.profiles = const [],
    this.loading = true,
    this.switching = false,
    this.error,
  });

  final BrokerConnectionStatus? status;
  final List<BrokerProfile> profiles;
  final bool loading;
  final bool switching;
  final String? error;

  BrokerUiState copyWith({
    BrokerConnectionStatus? status,
    List<BrokerProfile>? profiles,
    bool? loading,
    bool? switching,
    String? error,
    bool clearError = false,
  }) =>
      BrokerUiState(
        status: status ?? this.status,
        profiles: profiles ?? this.profiles,
        loading: loading ?? this.loading,
        switching: switching ?? this.switching,
        error: clearError ? null : (error ?? this.error),
      );
}

class BrokerRepository extends Notifier<BrokerUiState> {
  Timer? _statusTimer;
  bool _disposed = false;
  int _bootGen = 0;

  BrokerApi get _api => ref.read(brokerApiProvider);

  @override
  BrokerUiState build() {
    ref.onDispose(_dispose);
    ref.listen(backendConfigProvider, (prev, next) {
      if (!next.ready) return;
      final urlChanged = prev == null || prev.apiBase != next.apiBase;
      final becameReady = prev == null || (!prev.ready && next.ready);
      if (urlChanged || becameReady) {
        Future.microtask(bootstrap);
      }
    }, fireImmediately: true);
    return const BrokerUiState(loading: true);
  }

  Future<void> bootstrap() async {
    _statusTimer?.cancel();
    final gen = ++_bootGen;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final profiles = await _api.profiles();
      final status = await _api.status();
      if (_disposed || gen != _bootGen) return;
      state = state.copyWith(
        profiles: profiles,
        status: status,
        loading: false,
        clearError: true,
      );
      _startPolling();
    } catch (e) {
      if (_disposed || gen != _bootGen) return;
      state = state.copyWith(
        loading: false,
        error: e is Exception ? e.toString().replaceFirst('Exception: ', '') : '$e',
      );
    }
  }

  void _startPolling() {
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(const Duration(seconds: 4), (_) => refreshStatus());
  }

  Future<void> refreshStatus() async {
    try {
      final s = await _api.status();
      if (_disposed) return;
      final switching = state.switching && !s.connected;
      state = state.copyWith(
        status: s,
        switching: switching ? state.switching : false,
        clearError: true,
      );
    } catch (e) {
      if (_disposed) return;
      state = state.copyWith(error: '$e');
    }
  }

  Future<void> connect(String profileId) async {
    state = state.copyWith(switching: true, clearError: true);
    try {
      final s = await _api.connect(profileId);
      if (_disposed) return;
      state = state.copyWith(status: s, switching: false, clearError: true);
      await ref.read(liveTerminalProvider.notifier).refreshNow();
    } catch (e) {
      if (_disposed) return;
      state = state.copyWith(
        switching: false,
        error: e is Exception ? e.toString().replaceFirst('Exception: ', '') : '$e',
      );
      try {
        final s = await _api.status();
        state = state.copyWith(status: s);
      } catch (_) {}
    }
  }

  Future<void> reconnect() async {
    state = state.copyWith(switching: true, clearError: true);
    try {
      final s = await _api.reconnect();
      if (_disposed) return;
      state = state.copyWith(status: s, switching: false, clearError: true);
      await ref.read(liveTerminalProvider.notifier).refreshNow();
    } catch (e) {
      if (_disposed) return;
      state = state.copyWith(
        switching: false,
        error: e is Exception ? e.toString().replaceFirst('Exception: ', '') : '$e',
      );
    }
  }

  void _dispose() {
    _disposed = true;
    _bootGen++;
    _statusTimer?.cancel();
    _statusTimer = null;
  }
}

final brokerConnectionProvider =
    NotifierProvider<BrokerRepository, BrokerUiState>(BrokerRepository.new);
