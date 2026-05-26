# Narrative Stability Requirement

**Status:** Core principle Phases 145, 148  
**Confidence:** HIGH

## Finding

**Narrative stability** is a prerequisite for aggressive execution. Unstable, failing, or exhausted narratives require conviction downgrade regardless of raw signal strength.

## Evidence

| Module | Observation |
|--------|-------------|
| Phase 145 | Weak transitions (`quality: WEAK`) predict failure |
| Phase 148 narrative confidence | Unstable rate >25% → calibration downgrade |
| Phase 148 live intel | Failing narrative → "Conviction calibrated LOWER" |
| Phase 143 | FULL_EXECUTION requires `narrativeStable !== false` + low regret |

## Stability scoring

`narrativeStability()` in adaptive-calibration.util:

- Penalizes unique state count and weak transitions
- Stable/improving trajectories allow aggression (Phase 148)

## Execution implication

- Check trajectory before sizing up
- NARRATIVE_FAILING / EXHAUSTED → REDUCE_SIZE or WAIT
- Stable SECOND_LEG_CONTINUATION → controlled aggression allowed

## Related phases

145, 148, 143
