class SymbolQuote {
  const SymbolQuote({
    required this.price,
    required this.change,
    required this.changePercent,
    required this.stale,
    this.volume,
    this.timestamp,
  });

  final double price;
  final double? change;
  final double? changePercent;
  final bool stale;
  final int? volume;
  final int? timestamp;

  factory SymbolQuote.fromJson(Map<String, dynamic> j) => SymbolQuote(
        price: (j['price'] as num?)?.toDouble() ?? 0,
        change: (j['change'] as num?)?.toDouble(),
        changePercent: (j['changePercent'] as num?)?.toDouble(),
        stale: j['stale'] as bool? ?? false,
        volume: (j['volume'] as num?)?.toInt(),
        timestamp: (j['timestamp'] as num?)?.toInt(),
      );
}

typedef QuoteBatch = Map<String, SymbolQuote>;
