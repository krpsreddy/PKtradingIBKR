import '../../models/quote.dart';

/// Lightweight in-memory quote cache — no intelligence logic.
class QuoteCache {
  final Map<String, SymbolQuote> _quotes = {};
  bool delayed = false;
  DateTime? lastFetchAt;

  SymbolQuote? get(String symbol) => _quotes[symbol.toUpperCase()];

  Map<String, SymbolQuote> get snapshot => Map.unmodifiable(_quotes);

  void apply(QuoteBatch batch, {required bool ok}) {
    lastFetchAt = DateTime.now();
    if (!ok) {
      delayed = true;
      return;
    }
    var anyStale = false;
    batch.forEach((sym, q) {
      _quotes[sym] = q;
      if (q.stale) anyStale = true;
    });
    delayed = anyStale;
  }

  void clear() {
    _quotes.clear();
    delayed = false;
    lastFetchAt = null;
  }
}
