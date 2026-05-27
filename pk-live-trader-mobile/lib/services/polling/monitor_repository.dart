import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/config/backend_config.dart';
import '../../models/paper_position.dart';
import '../api/paper_execution_api.dart';

class MonitorState {
  const MonitorState({
    this.snapshot,
    this.analytics,
    this.loading = true,
    this.error,
  });

  final PaperMonitorSnapshot? snapshot;
  final ExecutionAnalytics? analytics;
  final bool loading;
  final String? error;
}

class MonitorRepository extends Notifier<MonitorState> {
  Timer? _timer;
  int _pollGen = 0;

  @override
  MonitorState build() {
    ref.onDispose(() {
      _timer?.cancel();
      _pollGen++;
    });
    ref.listen(backendConfigProvider, (prev, next) {
      if (!next.ready) return;
      final urlChanged = prev == null || prev.apiBase != next.apiBase;
      final becameReady = prev == null || (!prev.ready && next.ready);
      if (urlChanged || becameReady) {
        Future.microtask(reconnect);
      }
    }, fireImmediately: true);
    return const MonitorState(loading: true);
  }

  Future<void> reconnect() async {
    _timer?.cancel();
    final gen = ++_pollGen;
    state = const MonitorState(loading: true);
    await _poll(gen);
    _timer = Timer.periodic(AppConfig.snapshotInterval, (_) => _poll(gen));
  }

  Future<void> _poll(int gen) async {
    try {
      final api = ref.read(paperExecutionApiProvider);
      final mon = await api.monitor().timeout(const Duration(seconds: 12));
      final analytics = await api.analytics().timeout(const Duration(seconds: 12));
      if (gen != _pollGen) return;
      state = MonitorState(snapshot: mon, analytics: analytics, loading: false);
    } catch (e) {
      if (gen != _pollGen) return;
      state = MonitorState(loading: false, error: e.toString());
    }
  }

  Future<void> refresh() => _poll(_pollGen);
}

final monitorProvider = NotifierProvider<MonitorRepository, MonitorState>(
  MonitorRepository.new,
);
