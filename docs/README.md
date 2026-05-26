# Project Documentation Index

Canonical project memory for the Adaptive Execution Intelligence Platform.

## Start here

1. **[PROJECT_INTELLIGENCE_README.md](../PROJECT_INTELLIGENCE_README.md)** — master reference for all Cursor sessions  
2. **[AUTONOMOUS_EXECUTION_TERMINOLOGY.md](architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md)** — canonical trader/regime/execution labels (read before UI or scanner changes)  
3. Latest **[phases/](phases/)** doc for the subsystem you are touching

## Directories

| Path | Contents |
|------|----------|
| [phases/](phases/) | Per-phase docs (137–154) |
| [architecture/](architecture/) | System design documents |
| [discoveries/](discoveries/) | Analytical findings over time |

## Phase index

| Phase | Doc |
|-------|-----|
| 137 Live Execution Gate | [PHASE_137.md](phases/PHASE_137.md) |
| 138 Governance | [PHASE_138.md](phases/PHASE_138.md) |
| 139 Playbook Discovery | [PHASE_139.md](phases/PHASE_139.md) |
| 140 Trade Lifecycle | [PHASE_140.md](phases/PHASE_140.md) |
| 141 Execution Quality + Edge Refinement | [PHASE_141.md](phases/PHASE_141.md) |
| 142 Entry Sequencing | [PHASE_142.md](phases/PHASE_142.md) |
| 143 Live Decision | [PHASE_143.md](phases/PHASE_143.md) |
| 144 Decision Feedback | [PHASE_144.md](phases/PHASE_144.md) |
| 145 Market Narrative | [PHASE_145.md](phases/PHASE_145.md) |
| 146 Adaptive Entry | [PHASE_146.md](phases/PHASE_146.md) |
| 147 Persistent Analytics | [PHASE_147.md](phases/PHASE_147.md) |
| 148 Adaptive Calibration | [PHASE_148.md](phases/PHASE_148.md) |
| 149 Incremental Replay Cache | [PHASE_149.md](phases/PHASE_149.md) |
| 150 Replay UX + Viewport | [PHASE_150.md](phases/PHASE_150.md) |
| 151 Multi-Day Replay Workstation | [PHASE_151.md](phases/PHASE_151.md) |
| 152 Replay Decision Visualization | [PHASE_152.md](phases/PHASE_152.md) |
| 153 Signal Explorer + Replay Navigation | [PHASE_153.md](phases/PHASE_153.md) |
| 154 Replay UX Stabilization | [PHASE_154.md](phases/PHASE_154.md) |

## Architecture Docs

| Document | Classification | Description |
|----------|----------------|-------------|
| [**AUTONOMOUS_EXECUTION_TERMINOLOGY.md**](architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md) | **Execution language · Governance** | Canonical trader-facing labels, regime IDs, source-of-truth file ownership, terminology governance, hybrid vs autonomous migration status, cheat sheet |
| [execution-flow.md](architecture/execution-flow.md) | Pipeline | End-to-end execution intelligence flow |
| [decision-engine.md](architecture/decision-engine.md) | Decision | Live decision orchestration |
| [replay-cache.md](architecture/replay-cache.md) | Replay | Incremental replay and cache |
| [analytics-persistence.md](architecture/analytics-persistence.md) | Persistence | PostgreSQL analytics storage |
| [narrative-system.md](architecture/narrative-system.md) | Narrative | Market state and narrative paths |
| [DASHBOARD_NETWORK_ARCHITECTURE.md](architecture/DASHBOARD_NETWORK_ARCHITECTURE.md) | Network | Dashboard API and hydration topology |

## Discoveries index

- [reclaim-confirmation-discovery.md](discoveries/reclaim-confirmation-discovery.md)
- [second-leg-edge.md](discoveries/second-leg-edge.md)
- [governance-overconservative.md](discoveries/governance-overconservative.md)
- [opening-extension-instability.md](discoveries/opening-extension-instability.md)
- [trap-location-danger.md](discoveries/trap-location-danger.md)
- [narrative-stability-requirement.md](discoveries/narrative-stability-requirement.md)

## Adding Phase 152+

1. Implement phase following existing synthesis pattern
2. Create `docs/phases/PHASE_149.md`
3. Append row to Section 3 in `PROJECT_INTELLIGENCE_README.md`
4. Update `docs/README.md` phase index
5. Add discoveries to `docs/discoveries/` if new findings emerge
6. Update architecture docs if data flow or decision logic changes
