import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/pk_theme.dart';
import '../core/util/formatters.dart';
import '../models/quote.dart';
import '../models/ranked_opportunity.dart';
import '../services/polling/live_trader_repository.dart';
import '../services/selection/selected_opportunity_state.dart';
import 'lifecycle_ribbon.dart';
import 'persistence_bar.dart';
import 'symbol_focus_header.dart';

/// Phase 215 — hero binds to [SelectedOpportunityView], not hard-coded dominant only.
class DominantHeroCard extends ConsumerWidget {
  const DominantHeroCard({super.key, required this.view});

  final SelectedOpportunityView view;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final opp = view.opportunity;
    if (opp == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SymbolFocusHeader(view: view),
          const SizedBox(height: 6),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('—', style: Theme.of(context).textTheme.headlineMedium),
                  const Text('Scanning idle', style: TextStyle(color: PkTheme.muted, fontSize: 12)),
                ],
              ),
            ),
          ),
        ],
      );
    }

    final quote = ref.watch(symbolQuoteProvider(opp.symbol));
    final tone = PkTheme.toneColor(opp.tone);
    final qualityColor = _qualityColor(opp.executionQuality);
    final velColor = _velocityColor(opp.velocityTrend);
    final narrative = _compactNarrative(opp);
    final rankLabel = view.listRank != null && view.listRank! > 0 ? '#${view.listRank}' : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SymbolFocusHeader(view: view),
        const SizedBox(height: 6),
        Card(
          child: Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border(
                    left: BorderSide(color: qualityColor, width: 4),
                    top: view.followTop
                        ? BorderSide.none
                        : BorderSide(color: PkTheme.blue.withValues(alpha: 0.55), width: 1),
                    right: view.followTop
                        ? BorderSide.none
                        : BorderSide(color: PkTheme.blue.withValues(alpha: 0.55), width: 1),
                    bottom: view.followTop
                        ? BorderSide.none
                        : BorderSide(color: PkTheme.blue.withValues(alpha: 0.55), width: 1),
                  ),
                  boxShadow: view.followTop
                      ? null
                      : [
                          BoxShadow(
                            color: PkTheme.blue.withValues(alpha: 0.12),
                            blurRadius: 8,
                            spreadRadius: 0,
                          ),
                        ],
                ),
                padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            formatRegimeLabel(opp.regime),
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: PkTheme.blue),
                          ),
                        ),
                        if (rankLabel != null) ...[
                          _Badge(rankLabel, PkTheme.muted),
                          const SizedBox(width: 4),
                        ],
                        if (view.fromBearishList) _Badge('BEARISH', PkTheme.red),
                        if (!view.fromBearishList && opp.dominanceScore >= 120) ...[
                          const SizedBox(width: 4),
                          _Badge('DOMINANT', PkTheme.green),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(opp.symbol, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                        const SizedBox(width: 8),
                        Text(
                          '${opp.convictionVelocity > 0 ? '+' : ''}${opp.convictionVelocity}',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: velColor),
                        ),
                        Text(opp.velocityTrend, style: TextStyle(fontSize: 9, color: velColor)),
                        const Spacer(),
                        _PriceBlock(quote: quote),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _Metric('Conv', '${opp.conviction}', tone),
                        _Metric('Dom', '${opp.dominanceScore}', PkTheme.green),
                        _Metric('Persist', '${opp.persistenceSeconds}', PkTheme.blue),
                        _Metric('RVOL', opp.rvol.toStringAsFixed(1), opp.rvol >= 1.5 ? PkTheme.green : PkTheme.muted),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _Metric('Exp', '${opp.expansionProbability}', PkTheme.yellow),
                        _Metric('Maturity', opp.maturityState, PkTheme.lifecycleColor(opp.maturityState)),
                        _Metric('Quality', opp.executionQuality, qualityColor),
                      ],
                    ),
                    const SizedBox(height: 4),
                    LifecycleRibbon(activePhase: opp.tradeLifecycle, compact: true),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _ContextChip('Stop ${opp.stopLabel}', PkTheme.red),
                        _ContextChip('Tgt ${opp.targetLabel}', PkTheme.blue),
                        _ContextChip('Proj ${opp.projectedR}', PkTheme.green),
                      ],
                    ),
                    const SizedBox(height: 4),
                    PersistenceBar(value: opp.institutionalPressure, compact: true),
                    if (narrative.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          narrative,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 10, color: PkTheme.yellow),
                        ),
                      ),
                    const SizedBox(height: 6),
                    _IntelligenceGrid(opp: opp),
                  ],
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: _FreshnessBadge(label: opp.dataFreshness),
              ),
            ],
          ),
        ),
      ],
    );
  }

  static String _compactNarrative(RankedOpportunity opp) {
    if (opp.whyNow.isEmpty) return '';
    return opp.whyNow.take(2).join(' · ');
  }

  static Color _qualityColor(String q) {
    switch (q.toUpperCase()) {
      case 'INSTITUTIONAL':
        return PkTheme.blue;
      case 'HIGH':
        return PkTheme.green;
      case 'MEDIUM':
        return PkTheme.yellow;
      default:
        return PkTheme.red;
    }
  }

  static Color _velocityColor(String trend) {
    switch (trend.toUpperCase()) {
      case 'ACCELERATING':
        return PkTheme.green;
      case 'DECAYING':
        return PkTheme.red;
      default:
        return PkTheme.yellow;
    }
  }
}

class _IntelligenceGrid extends StatelessWidget {
  const _IntelligenceGrid({required this.opp});

  final RankedOpportunity opp;

  @override
  Widget build(BuildContext context) {
    final bear = opp.bearishOps;
    final put = opp.putAssist;
    final rows = <_IntelRow>[
      _IntelRow('Integrity', opp.dataFreshness, _freshnessColor(opp.dataFreshness)),
      _IntelRow('Market', opp.marketAligned ? 'ALIGNED' : 'DIVERGENT', opp.marketAligned ? PkTheme.green : PkTheme.orange),
      if (bear?.deterioration != null && bear!.deterioration!.isNotEmpty)
        _IntelRow('Deterioration', bear.deterioration!, PkTheme.red),
      if (bear?.longSuppression != null && bear!.longSuppression!.isNotEmpty)
        _IntelRow('Long supp', bear.longSuppression!, PkTheme.orange),
      if (bear?.directionalConflict != null && bear!.directionalConflict!.isNotEmpty)
        _IntelRow('Conflict', bear.directionalConflict!, PkTheme.yellow),
      if (bear?.premarketChip != null && bear!.premarketChip!.isNotEmpty)
        _IntelRow('PM', bear.premarketChip!, PkTheme.blue),
      if (put?.putAssistGrade != null && put!.putAssistGrade!.isNotEmpty)
        _IntelRow('PUT assist', put.putAssistGrade!, PkTheme.red)
      else if (bear?.putAssistGrade != null && bear!.putAssistGrade!.isNotEmpty)
        _IntelRow('PUT assist', bear.putAssistGrade!, PkTheme.red),
      if (put != null && put.active)
        _IntelRow('Bear bias', '${put.bearishBias}', PkTheme.red),
      if (put != null && put.bearishState.isNotEmpty)
        _IntelRow('Bear state', put.bearishState, PkTheme.orange),
    ];

    if (rows.isEmpty) {
      return const SizedBox.shrink();
    }

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: rows.map((r) => _IntelChip(row: r)).toList(),
    );
  }

  static Color _freshnessColor(String label) {
    switch (label.toUpperCase()) {
      case 'LIVE':
        return PkTheme.green;
      case 'DELAYED':
        return PkTheme.yellow;
      default:
        return PkTheme.red;
    }
  }
}

class _IntelRow {
  const _IntelRow(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color color;
}

class _IntelChip extends StatelessWidget {
  const _IntelChip({required this.row});

  final _IntelRow row;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: row.color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: row.color.withValues(alpha: 0.35)),
      ),
      child: Text(
        '${row.label}: ${row.value}',
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: row.color),
      ),
    );
  }
}

class _FreshnessBadge extends StatelessWidget {
  const _FreshnessBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final l = label.toUpperCase();
    final color = l == 'LIVE' ? PkTheme.green : l == 'DELAYED' ? PkTheme.yellow : PkTheme.red;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(3),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(l, style: TextStyle(fontSize: 7, fontWeight: FontWeight.w800, color: color)),
    );
  }
}

class _ContextChip extends StatelessWidget {
  const _ContextChip(this.text, this.color);

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Text(text, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _PriceBlock extends StatelessWidget {
  const _PriceBlock({this.quote});

  final SymbolQuote? quote;

  @override
  Widget build(BuildContext context) {
    final pct = quote?.changePercent;
    final up = (pct ?? 0) >= 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          formatPrice(quote?.price),
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: quote == null ? PkTheme.muted : (up ? PkTheme.green : PkTheme.red),
          ),
        ),
        Text(formatPct(pct), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: up ? PkTheme.green : PkTheme.red)),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.color);

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 4),
        padding: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(
          color: PkTheme.bg,
          borderRadius: BorderRadius.circular(5),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 8, color: PkTheme.muted)),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: label == 'Maturity' ? 9 : 13, fontWeight: FontWeight.w800, color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text, this.color);

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text, style: TextStyle(fontSize: 7, fontWeight: FontWeight.w800, color: color)),
    );
  }
}
