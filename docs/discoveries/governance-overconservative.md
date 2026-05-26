# Governance Over-Conservative Discovery

**Status:** Identified Phases 144, 148  
**Confidence:** MEDIUM (regime-dependent; n ≥ 25 for authoritative)

## Finding

Platform governance and wait logic are **historically too conservative** in fast continuation environments — producing false avoids, excessive waiting, and missed expansion on valid winners.

## Evidence

| Module | Metric |
|--------|--------|
| Phase 144 regret | `falseAvoids`, `excessiveWaiting`, high `regretScore` |
| Phase 148 governance balance | `TOO_CONSERVATIVE` when falseAvoidRate > 15% AND missedExpansionRate > 12% |
| Phase 148 suppression | CHASE zone often `UNSAFE` — filters continuation winners |
| Phase 148 calibration | MODERATE conviction frequently `UNDERSTATED` |

## Symptoms

- HIGH conviction expected +2R, actual +0.8R (overstated in weak environments)
- WAIT_FOR_PULLBACK: fakeout ↓ but missed expansion 40–50%
- TRAP_RISK safe; CHASE suppression unsafe

## Execution implication

- Phase 148 allows `PROBING_EXECUTION` when governance too conservative + narrative stable
- Calibration line: "Governance too conservative in this context"
- Do NOT remove trap filters — rebalance aggression vs safety

## Related phases

137/138 (governance), 144 (regret), 148 (calibration)

## Safety

Calibration adjusts advisory overlays only — no automatic governance threshold changes.
