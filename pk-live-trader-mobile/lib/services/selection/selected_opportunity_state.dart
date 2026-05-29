import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/bearish_opportunity.dart';
import '../../models/ranked_opportunity.dart';
import '../polling/live_trader_repository.dart';
import 'opportunity_lookup.dart';

/// Phase 215 — manual symbol focus (does not affect ranking order).
class SelectedOpportunityState {
  const SelectedOpportunityState({
    this.manualSymbol,
    this.followTop = true,
  });

  /// Locked symbol when [followTop] is false.
  final String? manualSymbol;

  /// When true, hero tracks backend #1 (dominant / first ranked).
  final bool followTop;

  SelectedOpportunityState copyWith({
    String? manualSymbol,
    bool? followTop,
    bool clearManualSymbol = false,
  }) =>
      SelectedOpportunityState(
        manualSymbol: clearManualSymbol ? null : (manualSymbol ?? this.manualSymbol),
        followTop: followTop ?? this.followTop,
      );
}

class SelectedOpportunityNotifier extends Notifier<SelectedOpportunityState> {
  @override
  SelectedOpportunityState build() => const SelectedOpportunityState();

  void selectSymbol(String symbol) {
    if (symbol.isEmpty) return;
    state = state.copyWith(manualSymbol: symbol, followTop: false);
  }

  void selectRanked(RankedOpportunity opp) => selectSymbol(opp.symbol);

  void selectBearish(BearishOpportunity opp) => selectSymbol(opp.symbol);

  void setFollowTop(bool enabled) {
    if (enabled) {
      state = state.copyWith(followTop: true, clearManualSymbol: true);
    } else {
      state = state.copyWith(followTop: false);
    }
  }
}

final selectedOpportunityNotifierProvider =
    NotifierProvider<SelectedOpportunityNotifier, SelectedOpportunityState>(
  SelectedOpportunityNotifier.new,
);

/// Resolved hero payload — ranking order unchanged; only display binding.
class SelectedOpportunityView {
  const SelectedOpportunityView({
    required this.opportunity,
    required this.followTop,
    this.listRank,
    this.fromBearishList = false,
  });

  final RankedOpportunity? opportunity;
  final bool followTop;
  final int? listRank;
  final bool fromBearishList;
}

final selectedOpportunityProvider = Provider<SelectedOpportunityView>((ref) {
  final terminal = ref.watch(liveTerminalProvider);
  final selection = ref.watch(selectedOpportunityNotifierProvider);
  final t1 = terminal.tier1;
  final top = OpportunityLookup.topOpportunity(t1);

  if (selection.followTop) {
    final rank = OpportunityLookup.rankInTopRanked(t1, top?.symbol);
    return SelectedOpportunityView(
      opportunity: top,
      followTop: true,
      listRank: rank,
    );
  }

  final sym = selection.manualSymbol;
  if (sym == null || sym.isEmpty) {
    return SelectedOpportunityView(
      opportunity: top,
      followTop: true,
      listRank: OpportunityLookup.rankInTopRanked(t1, top?.symbol),
    );
  }

  final resolved = OpportunityLookup.resolve(
    t1: t1,
    snapshot: terminal.snapshot,
    symbol: sym,
  );
  return SelectedOpportunityView(
    opportunity: resolved?.opportunity,
    followTop: false,
    listRank: resolved?.listRank,
    fromBearishList: resolved?.fromBearishList ?? false,
  );
});
