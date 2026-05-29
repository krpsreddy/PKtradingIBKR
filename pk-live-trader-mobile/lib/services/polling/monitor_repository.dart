import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/config/backend_config.dart';
import '../../core/util/api_errors.dart';
import '../../models/paper_position.dart';
import '../api/live_trader_api.dart';
import '../api/paper_execution_api.dart';
import '../../models/operational_monitor.dart';
import '../../models/stream_state.dart';

class MonitorState {
  const MonitorState({
    this.snapshot,
    this.analytics,
    this.ops,
    this.streamState,
    this.loading = true,
    this.error,
  });

  final PaperMonitorSnapshot? snapshot;
  final ExecutionAnalytics? analytics;
  final OperationalMonitor? ops;
  final StreamState? streamState;
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
      final paperApi = ref.read(paperExecutionApiProvider);
      final liveApi = ref.read(liveTraderApiProvider);
      const slow = Duration(seconds: 45);
      final results = await Future.wait([
        paperApi.monitor().timeout(slow),
        paperApi.analytics().timeout(slow),
        liveApi.ops().timeout(slow),
        liveApi.streamState().timeout(slow),
      ]);
      if (gen != _pollGen) return;
      state = MonitorState(
        snapshot: results[0] as PaperMonitorSnapshot,
        analytics: results[1] as ExecutionAnalytics,
        ops: results[2] as OperationalMonitor,
        streamState: results[3] as StreamState,
        loading: false,
      );
    } catch (e) {
      if (gen != _pollGen) return;
      final hasCache = state.snapshot != null || state.ops != null;
      if (isTransientApiError(e) && hasCache) {
        state = MonitorState(
          snapshot: state.snapshot,
          analytics: state.analytics,
          ops: state.ops,
          streamState: state.streamState,
          loading: false,
        );
        return;
      }
      state = MonitorState(loading: false, error: friendlyApiError(e));
    }
  }

  Future<void> refresh() => _poll(_pollGen);
}

final monitorProvider = NotifierProvider<MonitorRepository, MonitorState>(
  MonitorRepository.new,
);
