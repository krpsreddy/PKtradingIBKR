import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/runtime_profile.dart';
import '../../services/api/dio_client.dart';
import '../../services/api/runtime_api.dart';
import 'backend_config.dart';
import 'runtime_config.dart';

const _prefRuntime = 'pk_trading_runtime';

class RuntimeProfileState {
  const RuntimeProfileState({
    required this.selected,
    this.remote,
    this.loading = false,
    this.error,
  });

  final TradingRuntime selected;
  final RuntimeProfile? remote;
  final bool loading;
  final String? error;

  String get bannerTitle {
    if (selected == TradingRuntime.paper) {
      return 'PAPER RUNTIME — AUTO PAPER ENABLED';
    }
    return 'LIVE RUNTIME — MANUAL ASSIST ONLY';
  }

  RuntimeProfileState copyWith({
    TradingRuntime? selected,
    RuntimeProfile? remote,
    bool? loading,
    String? error,
    bool clearError = false,
  }) =>
      RuntimeProfileState(
        selected: selected ?? this.selected,
        remote: remote ?? this.remote,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class RuntimeProfileNotifier extends Notifier<RuntimeProfileState> {
  @override
  RuntimeProfileState build() {
    Future.microtask(_init);
    return RuntimeProfileState(selected: RuntimeConfig.platformDefault());
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefRuntime);
    final selected = raw == 'live' ? TradingRuntime.live : RuntimeConfig.platformDefault();
    state = state.copyWith(selected: selected);
    await ref.read(backendConfigProvider.notifier).applyRuntime(selected);
    await refreshRemote();
  }

  Future<void> setRuntime(TradingRuntime runtime) async {
    state = state.copyWith(loading: true, clearError: true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefRuntime, runtime == TradingRuntime.live ? 'live' : 'paper');
    state = state.copyWith(selected: runtime);
    await ref.read(backendConfigProvider.notifier).applyRuntime(runtime);
    await refreshRemote();
  }

  Future<void> refreshRemote() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final profile = await ref.read(runtimeApiProvider).fetchProfile();
      state = state.copyWith(remote: profile, loading: false, clearError: true);
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }
}

final runtimeApiProvider = Provider<RuntimeApi>((ref) {
  return RuntimeApi(ref.watch(dioProvider));
});

final runtimeProfileProvider =
    NotifierProvider<RuntimeProfileNotifier, RuntimeProfileState>(
  RuntimeProfileNotifier.new,
);
