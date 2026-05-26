import { LiveDecisionContext } from './live-decision.models';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;

export function extensionPct(ctx: LiveDecisionContext): number {
  return Math.abs(ctx.vwapDistance ?? 0) * 100;
}

export function breadthStrong(ctx: LiveDecisionContext): boolean {
  return (ctx.trendAlignment ?? 0) >= 70;
}

export function breadthWeak(ctx: LiveDecisionContext): boolean {
  return (ctx.trendAlignment ?? 0) < 50;
}

export function isChase(ctx: LiveDecisionContext): boolean {
  const eq = (ctx.entryQuality ?? '').toUpperCase();
  return eq.includes('CHASE') || !!ctx.extended || extensionPct(ctx) >= 6;
}

export function isLate(ctx: LiveDecisionContext): boolean {
  const eq = (ctx.entryQuality ?? '').toUpperCase();
  return eq.includes('LATE') || (ctx.signalAgeMinutes ?? 0) > 12;
}

export function fakeoutHigh(ctx: LiveDecisionContext): boolean {
  return ctx.fakeoutRisk === 'HIGH' || ctx.fakeoutRisk === 'EXTREME';
}

export function governanceToxic(ctx: LiveDecisionContext): boolean {
  return ctx.governanceState === 'TOXIC' || ctx.governanceState === 'SUPPRESS';
}

export function governanceAllow(ctx: LiveDecisionContext): boolean {
  return ctx.governanceState === 'ALLOW';
}

export function decisionLabel(d: string): string {
  return d.replace(/_/g, ' ');
}

export function timingLabel(t: string): string {
  switch (t) {
    case 'NOW': return 'Enter now — acceptance confirmed';
    case 'WAIT_FOR_HOLD': return 'Wait for reclaim hold';
    case 'WAIT_FOR_PULLBACK': return 'Wait for pullback stabilization';
    case 'WAIT_FOR_SECOND_LEG': return 'Wait for second-leg confirmation';
    case 'TOO_LATE': return 'Too late — extension elevated';
    default: return t.replace(/_/g, ' ');
  }
}

export function riskLabel(ctx: LiveDecisionContext): string {
  if (fakeoutHigh(ctx)) return 'High fakeout risk';
  if (ctx.fakeoutRisk === 'MEDIUM') return 'Moderate fakeout risk';
  if (breadthWeak(ctx)) return 'Weak breadth risk';
  if (extensionPct(ctx) >= 8) return 'Extension risk elevated';
  return 'Low fakeout risk';
}
