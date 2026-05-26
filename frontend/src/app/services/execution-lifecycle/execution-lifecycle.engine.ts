/** Phase 169 — execution lifecycle visualization model. */

export type LifecycleStageId =
  | 'DEVELOPING'
  | 'EARLY_EXPANSION'
  | 'PERSISTENCE'
  | 'SHALLOW_PB'
  | 'CONFIRMED'
  | 'ADD'
  | 'EXTENDED'
  | 'EXHAUSTING'
  | 'FAILED';

export interface LifecycleStage {
  id: LifecycleStageId;
  label: string;
  active: boolean;
  complete: boolean;
  durationSeconds: number;
  stability: number;
  nextStageProbability: number;
}

export interface LifecycleTimeline {
  stages: LifecycleStage[];
  currentStageId: LifecycleStageId;
  currentIndex: number;
  progressPct: number;
}

const STAGE_ORDER: LifecycleStageId[] = [
  'DEVELOPING',
  'EARLY_EXPANSION',
  'PERSISTENCE',
  'SHALLOW_PB',
  'CONFIRMED',
  'ADD',
  'EXTENDED',
  'EXHAUSTING',
  'FAILED'
];

export interface LifecycleInput {
  maturityState: string;
  opportunityType?: string;
  persistenceSeconds?: number;
  convictionScore?: number;
  convictionVelocity?: number;
}

/** Maps maturity + type into full lifecycle timeline for UI. */
export function buildLifecycleTimeline(input: LifecycleInput): LifecycleTimeline {
  const maturity = input.maturityState.toUpperCase();
  const type = (input.opportunityType ?? '').toUpperCase();
  const persist = input.persistenceSeconds ?? 0;
  const conviction = input.convictionScore ?? 50;
  const velocity = input.convictionVelocity ?? 0;

  let current: LifecycleStageId = 'DEVELOPING';
  if (type.includes('EXHAUSTION') || maturity === 'EXHAUSTING') current = 'EXHAUSTING';
  else if (maturity === 'FAILED') current = 'FAILED';
  else if (maturity === 'EXTENDED') current = 'EXTENDED';
  else if (maturity === 'CONFIRMED') current = conviction >= 85 && persist >= 20 ? 'ADD' : 'CONFIRMED';
  else if (maturity === 'CONFIRMING') current = type.includes('PULLBACK') ? 'SHALLOW_PB' : 'PERSISTENCE';
  else if (maturity === 'DEVELOPING') current = type.includes('EARLY') ? 'EARLY_EXPANSION' : 'DEVELOPING';

  const currentIndex = STAGE_ORDER.indexOf(current);
  const stability = clamp(50 + persist * 1.5 + conviction * 0.2 - Math.abs(velocity) * 0.3);
  const nextProb = computeNextProbability(current, conviction, velocity);

  const stages: LifecycleStage[] = STAGE_ORDER.map((id, idx) => ({
    id,
    label: stageLabel(id),
    active: idx === currentIndex,
    complete: idx < currentIndex,
    durationSeconds: idx === currentIndex ? persist : 0,
    stability: idx === currentIndex ? stability : idx < currentIndex ? 85 : 0,
    nextStageProbability: idx === currentIndex ? nextProb : 0
  }));

  const progressPct = currentIndex <= 0 ? 8 : Math.round((currentIndex / (STAGE_ORDER.length - 1)) * 100);

  return { stages, currentStageId: current, currentIndex, progressPct };
}

export function stageLabel(id: LifecycleStageId): string {
  return id.replace(/_/g, ' ');
}

function computeNextProbability(current: LifecycleStageId, conviction: number, velocity: number): number {
  const base: Record<LifecycleStageId, number> = {
    DEVELOPING: 35,
    EARLY_EXPANSION: 48,
    PERSISTENCE: 58,
    SHALLOW_PB: 62,
    CONFIRMED: 55,
    ADD: 42,
    EXTENDED: 28,
    EXHAUSTING: 18,
    FAILED: 5
  };
  return clamp(Math.round((base[current] ?? 40) + velocity * 0.4 + (conviction - 60) * 0.15));
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
