import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/config/backend_config.dart';
import '../../core/util/api_errors.dart';
import '../../models/live_trader_snapshot.dart';
import '../../models/quote.dart';
import '../../models/portfolio_state.dart';
import '../../models/runtime_controls.dart';
import '../../models/tier1_snapshot.dart';
import '../api/live_trader_api.dart';
import '../api/paper_execution_api.dart';
import '../api/quotes_api.dart';
import '../quote/quote_cache.dart';
import '../selection/selected_opportunity_state.dart';

/// Aggregated live terminal state — backend is source of truth.
class LiveTerminalState {
  const LiveTerminalState({
    this.tier1,
    this.liveScan,
    this.snapshot,
    this.runtime,
    this.quotes = const {},
    this.quoteDelayed = false,
    this.loading = true,
    this.error,
    this.lastTier1At,
    this.lastSnapshotAt,
    this.portfolio,
  });

  final Tier1Snapshot? tier1;
  final Tier1Snapshot? liveScan;
  final LiveTraderSnapshot? snapshot;
  final RuntimeControls? runtime;
  final Map<String, SymbolQuote> quotes;
  final bool quoteDelayed;
  final bool loading;
  final String? error;
  final DateTime? lastTier1At;
  final DateTime? lastSnapshotAt;
  final PortfolioState? portfolio;

  LiveTerminalState copyWith({
    Tier1Snapshot? tier1,
    Tier1Snapshot? liveScan,
    LiveTraderSnapshot? snapshot,
    RuntimeControls? runtime,
    Map<String, SymbolQuote>? quotes,
    bool? quoteDelayed,
    bool? loading,
    String? error,
    DateTime? lastTier1At,
    DateTime? lastSnapshotAt,
    PortfolioState? portfolio,
    bool clearError = false,
  }) =>
      LiveTerminalState(
        tier1: tier1 ?? this.tier1,
        liveScan: liveScan ?? this.liveScan,
        snapshot: snapshot ?? this.snapshot,
        runtime: runtime ?? this.runtime,
        quotes: quotes ?? this.quotes,
        quoteDelayed: quoteDelayed ?? this.quoteDelayed,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        lastTier1At: lastTier1At ?? this.lastTier1At,
        lastSnapshotAt: lastSnapshotAt ?? this.lastSnapshotAt,
        portfolio: portfolio ?? this.portfolio,
      );
}

class LiveTraderRepository extends Notifier<LiveTerminalState> {
  final QuoteCache _quoteCache = QuoteCache();
  Timer? _tier1Timer;
  Timer? _liveScanTimer;
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
      final rt = await _api.runtime().timeout(const Duration(seconds: 25));
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
    _liveScanTimer =
        Timer.periodic(AppConfig.scannerInterval, (_) => _pollLiveScan());
    _snapshotTimer =
        Timer.periodic(AppConfig.snapshotInterval, (_) => _pollSnapshot());
    _quoteTimer = Timer.periodic(AppConfig.quotesInterval, (_) => _pollQuotes());

    _pollTier1();
    _pollLiveScan();
    _pollSnapshot();
    _pollQuotes();
  }

  Future<void> _pollLiveScan() async {
    if (!(state.runtime?.scanningEnabled ?? true)) return;
    try {
      final scan = await _api.liveScan(limit: AppConfig.scannerRowLimit);
      if (_disposed) return;
      state = state.copyWith(liveScan: scan, clearError: true);
      _pollQuotes();
    } catch (e) {
      _onPollError(e, hasCachedData: state.liveScan != null || state.tier1 != null);
    }
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
      _onPollError(e, hasCachedData: state.tier1 != null);
    }
  }

  Future<void> _pollSnapshot() async {
    if (!(state.runtime?.scanningEnabled ?? true)) return;
    try {
      final snap = await _api.snapshot();
      PortfolioState? portfolio;
      try {
        portfolio = await _api.portfolioState();
      } catch (_) {}
      if (_disposed) return;
      state = state.copyWith(
        snapshot: snap,
        runtime: snap.runtime,
        portfolio: portfolio,
        lastSnapshotAt: DateTime.now(),
        clearError: true,
      );
    } catch (e) {
      _onPollError(e, hasCachedData: state.snapshot != null);
    }
  }

  void _onPollError(Object e, {required bool hasCachedData}) {
    if (isTransientApiError(e) && hasCachedData) {
      return;
    }
    state = state.copyWith(error: friendlyApiError(e));
  }

  List<String> _visibleSymbols() {
    final syms = <String>{};
    final scan = state.liveScan ?? state.tier1;
    if (scan?.dominant != null) syms.add(scan!.dominant!.symbol);
    for (final o in scan?.topRanked ?? const []) {
      syms.add(o.symbol);
    }
    final t1 = state.tier1;
    if (t1?.dominant != null) syms.add(t1!.dominant!.symbol);
    for (final o in t1?.topRanked ?? const []) {
      syms.add(o.symbol);
    }
    for (final p in state.snapshot?.activePositions ?? const []) {
      syms.add(p.symbol);
    }
    for (final b in state.snapshot?.topBearishOpportunities ?? const []) {
      syms.add(b.symbol);
    }
    final manual = ref.read(selectedOpportunityNotifierProvider).manualSymbol;
    if (manual != null && manual.isNotEmpty) {
      syms.add(manual);
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
        _liveScanTimer?.cancel();
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

  Future<void> toggleBackgroundHydration() async {
    final rt = state.runtime;
    if (rt == null) return;
    await updateRuntime(
      rt.copyWith(backgroundHydrationEnabled: !rt.backgroundHydrationEnabled),
    );
  }

  Future<void> togglePutAssist() async {
    final rt = state.runtime;
    if (rt == null) return;
    await updateRuntime(rt.copyWith(
      bearishAssistMode: rt.putAssistEnabled ? 'LONG_ONLY' : 'LONG_PLUS_PUT_ASSIST',
    ));
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

  Future<void> activateKillSwitch() async {
    await _api.killSwitch();
    final rt = await _api.runtime();
    state = state.copyWith(runtime: rt, clearError: true);
    _cancelTimers();
  }

  Future<void> resetKillSwitch() async {
    await _api.resetKillSwitch();
    final rt = await _api.runtime();
    state = state.copyWith(runtime: rt, clearError: true);
    _startPolling();
  }

  Future<void> refreshNow() async {
    if (state.loading) {
      await reconnect();
      return;
    }
    await Future.wait([_pollTier1(), _pollLiveScan(), _pollSnapshot(), _pollQuotes()]);
  }

  void _cancelTimers() {
    _tier1Timer?.cancel();
    _liveScanTimer?.cancel();
    _snapshotTimer?.cancel();
    _quoteTimer?.cancel();
    _tier1Timer = null;
    _liveScanTimer = null;
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
