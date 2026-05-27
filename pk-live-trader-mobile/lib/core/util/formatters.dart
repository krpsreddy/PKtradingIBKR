import 'package:intl/intl.dart';

String formatPrice(double? v) {
  if (v == null || v.isNaN) return '—';
  return '\$${v.toStringAsFixed(2)}';
}

String formatPct(double? pct) {
  if (pct == null || pct.isNaN) return '—';
  final sign = pct > 0 ? '+' : '';
  return '$sign${pct.toStringAsFixed(2)}%';
}

String formatR(num? v) {
  if (v == null) return '—';
  return v.toStringAsFixed(3);
}

String formatUsd(double? v) {
  if (v == null || v.isNaN) return '—';
  final sign = v >= 0 ? '+' : '';
  return '$sign\$${v.abs().toStringAsFixed(2)}';
}

String formatRegimeLabel(String raw) {
  return raw.replaceAll('_', ' ').toLowerCase().split(' ').map((w) {
    if (w.isEmpty) return w;
    return '${w[0].toUpperCase()}${w.substring(1)}';
  }).join(' ');
}

String formatTimeMs(int? ms) {
  if (ms == null) return '';
  return DateFormat.Hm().format(DateTime.fromMillisecondsSinceEpoch(ms));
}
