import 'package:flutter/material.dart';

import '../../core/theme/pk_theme.dart';
import '../../models/ranked_opportunity.dart';

/// Phase 210 — left accent + chip labels for ranked rows.
class OpportunityAccent {
  OpportunityAccent._();

  static Color borderColor(RankedOpportunity opp) {
    final conflict = opp.bearishOps?.directionalConflict;
    if (conflict == 'HIGH' || conflict == 'MODERATE') {
      return PkTheme.yellow;
    }
    if (opp.bearishOps?.longSuppression == 'BLOCK') {
      return PkTheme.red;
    }
    final bias = opp.bearishOps?.putAssistGrade;
    if (bias == 'A_PLUS' || bias == 'A' || bias == 'A+'
        || opp.putAssist?.putAssistGrade == 'A_PLUS'
        || opp.putAssist?.putAssistGrade == 'A'
        || opp.putAssist?.putAssistGrade == 'A+') {
      return PkTheme.red.withValues(alpha: 0.7);
    }
    return PkTheme.green;
  }

  static List<String> chips(RankedOpportunity opp) {
    final out = <String>[];
    final chip = opp.bearishOps?.operationalChip;
    if (chip != null && chip.isNotEmpty) {
      out.add(chip);
    }
    final pm = opp.bearishOps?.premarketChip;
    if (pm != null && pm.isNotEmpty && !out.contains(pm)) {
      out.add(pm);
    }
    if (out.isEmpty && opp.putAssist?.active == true && opp.putAssist?.badgeLabel != null) {
      out.add(opp.putAssist!.badgeLabel!);
    }
    if (opp.bearishOps?.longSuppression == 'BLOCK' && !out.contains('LONG BLOCKED')) {
      out.add('LONG BLOCKED');
    }
    final conflict = opp.bearishOps?.directionalConflict;
    if (conflict == 'HIGH' && !out.any((c) => c.contains('CONFLICT') || c.contains('CHOP'))) {
      out.add('CHOP RISK');
    }
    return out.take(2).toList();
  }
}
