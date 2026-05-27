import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/config/backend_config.dart';
import '../../models/live_trader_snapshot.dart';
import '../../models/quote.dart';
import '../../models/runtime_controls.dart';
import '../../models/tier1_snapshot.dart';
import '../api/live_trader_api.dart';
import '../api/paper_execution_api.dart';
import '../api/quotes_api.dart';
import '../quote/quote_cache.dart';

/// Aggregated live terminal state — backend is source of truth.
class LiveTerminalState {
  const LiveTerminalState({
    this.tier1,
    this.snapshot,
    this.runtime,
    this.quotes = const {},
    this.quoteDelayed = false,
    this.loading = true,
    this.error,
    this.lastTier1At,
    this.lastSnapshotAt,
  });

  final Tier1Snapshot? tier1;
  final LiveTraderSnapshot? snapshot;
  final RuntimeControls? runtime;
  final Map<String, SymbolQuote> quotes;
  final bool quoteDelayed;
  final bool loading;
  final String? error;
  final DateTime? lastTier1At;
  final DateTime? lastSnapshotAt;

  LiveTerminalState copyWith({
    Tier1Snapshot? tier1,
    LiveTraderSnapshot? snapshot,
    RuntimeControls? runtime,
    Map<String, SymbolQuote>? quotes,
    bool? quoteDelayed,
    bool? loading,
    String? error,
    DateTime? lastTier1At,
    DateTime? lastSnapshotAt,
    bool clearError = false,
  }) =>
      LiveTerminalState(
        tier1: tier1 ?? this.tier1,
        snapshot: snapshot ?? this.snapshot,
        runtime: runtime ?? this.runtime,
        quotes: quotes ?? this.quotes,
        quoteDelayed: quoteDelayed ?? this.quoteDelayed,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        lastTier1At: lastTier1At ?? this.lastTier1At,
        lastSnapshotAt: lastSnapshotAt ?? this.lastSnapshotAt,
      );
}

class LiveTraderRepository extends Notifier<LiveTerminalState> {
  final QuoteCache _quoteCache = QuoteCache();
  Timer? _tier1Timer;
  Timer? _snapshotTimer;
  Timer? _quoteTimer;
  bool _disposed = false;
  int _bootGen = 0;

  LiveTraderApi get _api => ref.read(liveTraderApiProvider);
  QuotesApi get _quotesApi => ref.read(quotesApiProvider);
  PaperExecutionApi get _paperApi => ref.read(paperExecutionApiProvider);

  @override
  LiveTerminalState build() {
    ref.onDispose(_dispose);
    ref.listen(backendConfigProvider, (prev, next) {
      if (!next.ready) return;
      final urlChanged = prev == null || prev.apiBase != next.apiBase;
      final becameReady = prev == null || (!prev.ready && next.ready);
      if (urlChanged || becameReady) {
        Future.microtask(reconnect);
      }
    }, fireImmediately: true);
    return const LiveTerminalState(loading: true);
  }

  /// Reconnect after API base URL change (avoids provider invalidate hang).
  Future<void> reconnect() async {
    _cancelTimers();
    _quoteCache.clear();
    final gen = ++_bootGen;
    state = state.copyWith(loading: true, clearError: true);
    await _bootstrap(gen);
  }

  Future<void> _bootstrap(int gen) async {
    try {
      final rt = await _api.runtime().timeout(const Duration(seconds: 12));
      if (_disposed || gen != _bootGen) return;
      state = state.copyWith(runtime: rt, loading: false, clearError: true);
      _startPolling();
    } catch (e) {
      if (_disposed || gen != _bootGen) return;
      final msg = e is TimeoutException
          ? 'Connection timed out'
          : (e is Exception ? e.toString().replaceFirst('Exception: ', '') : '$e');
      state = state.copyWith(
        loading: false,
        error: 'Backend unreachable: $msg',
      );
    }
  }

  void _startPolling() {
    _tier1Timer?.cancel();
    _snapshotTimer?.cancel();
    _quoteTimer?.cancel();

    _tier1Timer = Timer.periodic(AppConfig.tier1Interval, (_) => _pollTier1());
    _snapshotTimer =
        Timer.periodic(AppConfig.snapshotInterval, (_) => _pollSnapshot());
    _quoteTimer = Timer.periodic(AppConfig.quotesInterval, (_) => _pollQuotes());

    _pollTier1();
    _pollSnapshot();
    _pollQuotes();
  }

  Future<void> _pollTier1() async {
    if (!(state.runtime?.scanningEnabled ?? true)) return;
    try {
      final t1 = await _api.tier1();
      if (_disposed) return;
      state = state.copyWith(
        tier1: t1,
        lastTier1At: DateTime.now(),
        clearError: true,
      );
      _pollQuotes();
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> _pollSnapshot() async {
    if (!(state.runtime?.scanningEnabled ?? true)) return;
    try {
      final snap = await _api.snapshot();
      if (_disposed) return;
      state = state.copyWith(
        snapshot: snap,
        runtime: snap.runtime,
        lastSnapshotAt: DateTime.now(),
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  List<String> _visibleSymbols() {
    final syms = <String>{};
    final t1 = state.tier1;
    if (t1?.dominant != null) syms.add(t1!.dominant!.symbol);
    for (final o in t1?.topRanked ?? const []) {
      syms.add(o.symbol);
    }
    for (final p in state.snapshot?.activePositions ?? const []) {
      syms.add(p.symbol);
    }
    return syms.take(32).toList();
  }

  Future<void> _pollQuotes() async {
    final symbols = _visibleSymbols();
    if (symbols.isEmpty) return;
    try {
      final batch = await _quotesApi.fetch(symbols);
      _quoteCache.apply(batch, ok: true);
      if (_disposed) return;
      state = state.copyWith(
        quotes: _quoteCache.snapshot,
        quoteDelayed: _quoteCache.delayed,
      );
    } catch (_) {
      _quoteCache.apply({}, ok: false);
      state = state.copyWith(quoteDelayed: true);
    }
  }

  Future<void> updateRuntime(RuntimeControls next) async {
    state = state.copyWith(runtime: next);
    try {
      final rt = await _api.putRuntime(next);
      if (next.executionMode == 'OFF' || next.executionMode == 'PAPER_RESEARCH') {
        await _paperApi.setMode(next.executionMode);
      }
      state = state.copyWith(runtime: rt, clearError: true);
      if (!rt.scanningEnabled) {
        _tier1Timer?.cancel();
        _snapshotTimer?.cancel();
        _quoteTimer?.cancel();
      } else {
        _startPolling();
      }
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  Future<void> toggleScanning() async {
    final rt = state.runtime;
    if (rt == null) return;
    await updateRuntime(rt.copyWith(scanningEnabled: !rt.scanningEnabled));
  }

  Future<void> toggleTelegram() async {
    final rt = state.runtime;
    if (rt == null) return;
    await updateRuntime(rt.copyWith(telegramEnabled: !rt.telegramEnabled));
  }

  Future<void> toggleAutoExec() async {
    final rt = state.runtime;
    if (rt == null) return;
    final paper = !rt.paperResearch;
    await updateRuntime(rt.copyWith(
      autoExecutionEnabled: paper,
      executionMode: paper ? 'PAPER_RESEARCH' : 'OFF',
    ));
  }

  Future<void> testTelegram() => _api.testTelegram();

  Future<void> refreshNow() async {
    if (state.loading) {
      await reconnect();
      return;
    }
    await Future.wait([_pollTier1(), _pollSnapshot(), _pollQuotes()]);
  }

  void _cancelTimers() {
    _tier1Timer?.cancel();
    _snapshotTimer?.cancel();
    _quoteTimer?.cancel();
    _tier1Timer = null;
    _snapshotTimer = null;
    _quoteTimer = null;
  }

  void _dispose() {
    _disposed = true;
    _bootGen++;
    _cancelTimers();
    _quoteCache.clear();
  }
}

final liveTerminalProvider =
    NotifierProvider<LiveTraderRepository, LiveTerminalState>(
  LiveTraderRepository.new,
);

/// Quote for a single symbol — rebuilds only quote slice consumers.
final symbolQuoteProvider = Provider.family<SymbolQuote?, String>((ref, sym) {
  return ref.watch(liveTerminalProvider).quotes[sym.toUpperCase()];
});
