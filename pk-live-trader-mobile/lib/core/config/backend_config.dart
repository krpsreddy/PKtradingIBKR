import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api/dio_client.dart';
import 'app_config.dart';
import 'backend_endpoint_resolver.dart';

const _prefRemote = 'pk_backend_use_remote';

class BackendConfigState {
  const BackendConfigState({
    required this.useRemote,
    required this.apiBase,
    this.ready = true,
    this.switching = false,
    this.lastError,
    this.viaTailscaleFallback = false,
  });

  final bool useRemote;
  final String apiBase;
  final bool ready;
  final bool switching;
  final String? lastError;
  final bool viaTailscaleFallback;

  String get modeLabel {
    if (useRemote) return 'Remote';
    if (viaTailscaleFallback) return 'Local·TS';
    return 'Local';
  }

  BackendConfigState copyWith({
    bool? useRemote,
    String? apiBase,
    bool? ready,
    bool? switching,
    String? lastError,
    bool? viaTailscaleFallback,
    bool clearError = false,
  }) =>
      BackendConfigState(
        useRemote: useRemote ?? this.useRemote,
        apiBase: apiBase ?? this.apiBase,
        ready: ready ?? this.ready,
        switching: switching ?? this.switching,
        lastError: clearError ? null : (lastError ?? this.lastError),
        viaTailscaleFallback: viaTailscaleFallback ?? this.viaTailscaleFallback,
      );
}

class BackendConfigNotifier extends Notifier<BackendConfigState> {
  @override
  BackendConfigState build() {
    Future.microtask(_loadFromPrefs);
    return BackendConfigState(
      useRemote: false,
      apiBase: AppConfig.defaultLocalBase,
      ready: false,
    );
  }

  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final remote = prefs.getBool(_prefRemote) ?? false;
    final resolved = await resolveReachableEndpoint(preferRemote: remote);
    if (resolved != null) {
      _applyResolved(resolved);
    } else {
      _applyResolved(ResolveResult(
        apiBase: remote ? AppConfig.remoteApiBase : AppConfig.defaultLocalBase,
        useRemote: remote,
      ));
    }
  }

  /// Returns error message if switch failed; null on success. [info] set when LAN uses Tailscale fallback.
  Future<({String? error, String? info})> trySetUseRemote(bool remote) async {
    if (state.switching) return (error: 'Switch already in progress', info: null);

    state = state.copyWith(switching: true, clearError: true);

    try {
      final resolved = await resolveReachableEndpoint(preferRemote: remote);
      if (resolved == null) {
        state = state.copyWith(switching: false, lastError: 'No reachable backend');
        return (
          error: remote
              ? 'Remote: turn Tailscale ON (same account as Mac).'
              : 'Local: same Wi‑Fi as Mac, allow Local Network, or use Remote.',
          info: null,
        );
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefRemote, remote);
      _applyResolved(resolved);
      state = state.copyWith(switching: false, clearError: true);

      final info = resolved.viaTailscaleFallback
          ? 'LAN blocked (VPN?). Using Tailscale ${AppConfig.remoteApiBase}'
          : null;
      return (error: null, info: info);
    } finally {
      if (state.switching) {
        state = state.copyWith(switching: false);
      }
    }
  }

  void _applyResolved(ResolveResult r) {
    state = BackendConfigState(
      useRemote: r.useRemote,
      apiBase: r.apiBase,
      ready: true,
      switching: false,
      viaTailscaleFallback: r.viaTailscaleFallback,
      lastError: state.lastError,
    );
    ref.invalidate(dioProvider);
  }
}

final backendConfigProvider =
    NotifierProvider<BackendConfigNotifier, BackendConfigState>(
  BackendConfigNotifier.new,
);
