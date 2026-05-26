# Trap Location Danger

**Status:** Validated Phases 141, 146, 148  
**Confidence:** HIGH

## Finding

Entries classified as **TRAP_LOCATION** (liquidity sweep zones, failed acceptance reversals) have strongly negative expectancy. TRAP_RISK suppression is well-calibrated; chasing into trap locations is the primary execution failure mode.

## Evidence

| Module | Observation |
|--------|-------------|
| Phase 146 entry location | TRAP_LOCATION — worst expectancy bucket |
| Phase 143 live decision | TRAP_LOCATION → TRAP_RISK decision |
| Phase 148 suppression | TRAP_RISK zone — SAFE suppression (>55% safe rate) |
| Phase 141 dangerous entry | Trap-adjacent conditions flagged |

## Execution implication

- Never FULL_EXECUTION at TRAP_LOCATION
- Preserve TRAP_RISK filter — calibration confirms it is safe to keep
- Entry location line should warn before decision banner

## Related phases

141, 143, 146, 148
