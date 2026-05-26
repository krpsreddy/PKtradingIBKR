/** Phase 169 — dominant trader action hierarchy. */

export type DominantAction = 'ENTER' | 'ADD' | 'HOLD' | 'WAIT' | 'REDUCE' | 'EXIT' | 'AVOID';

export interface DominantActionResult {
  primaryAction: DominantAction;
  primaryLabel: string;
  secondaryAction: DominantAction | null;
  secondaryLabel: string | null;
  confidence: number;
  cssClass: string;
}

export interface ActionDominanceInput {
  action?: string;
  maturityState?: string;
  opportunityType?: string;
  convictionScore: number;
  urgencyScore: number;
  preConfirmation?: boolean;
  exhaustionProbability?: number;
}

/** Derives unambiguous primary/secondary actions for cards and feed rows. */
export function deriveDominantAction(input: ActionDominanceInput): DominantActionResult {
  const type = (input.opportunityType ?? '').toUpperCase();
  const maturity = (input.maturityState ?? '').toUpperCase();
  const action = (input.action ?? '').toUpperCase();

  if (type.includes('EXHAUSTION') || action === 'AVOID' || maturity === 'EXHAUSTING' || maturity === 'FAILED') {
    return pack('AVOID', 'AVOID CHOP', 'EXIT', 'EXIT WEAKENING', input.convictionScore, 'action-avoid');
  }

  if (maturity === 'EXTENDED' || type.includes('RESUMPTION')) {
    if (input.convictionScore >= 80) {
      return pack('ADD', 'ADD ON PB', 'REDUCE', 'REDUCE EXTENSION', input.urgencyScore, 'action-add');
    }
    return pack('REDUCE', 'REDUCE EXTENSION', 'HOLD', 'HOLD TRAIL', input.convictionScore, 'action-reduce');
  }

  if (maturity === 'CONFIRMED' || (action === 'ENTER' && input.convictionScore >= 78)) {
    return pack('ENTER', 'ENTER NOW', 'ADD', 'ADD ON PB', input.urgencyScore, 'action-enter');
  }

  if (maturity === 'CONFIRMING' || action === 'WATCH') {
    if (input.preConfirmation) {
      return pack('WAIT', 'WAIT FOR ACCEPTANCE', 'HOLD', 'HOLD STRUCTURE', input.convictionScore, 'action-wait');
    }
    return pack('HOLD', 'HOLD STRUCTURE', 'WAIT', 'WAIT FOR ACCEPTANCE', input.convictionScore, 'action-hold');
  }

  if (action === 'ADD') {
    return pack('ADD', 'ADD ON PB', 'HOLD', 'HOLD STRUCTURE', input.urgencyScore, 'action-add');
  }

  if (action === 'EXIT') {
    return pack('EXIT', 'EXIT WEAKENING', 'REDUCE', 'REDUCE EXTENSION', input.convictionScore, 'action-exit');
  }

  if (input.preConfirmation || maturity === 'DEVELOPING') {
    return pack('WAIT', 'WAIT FOR ACCEPTANCE', null, null, input.convictionScore, 'action-wait');
  }

  if (input.convictionScore >= 72) {
    return pack('ENTER', 'ENTER NOW', 'WAIT', 'WAIT FOR ACCEPTANCE', input.urgencyScore, 'action-enter');
  }

  return pack('HOLD', 'HOLD STRUCTURE', 'WAIT', 'WAIT FOR ACCEPTANCE', input.convictionScore, 'action-hold');
}

function pack(
  primary: DominantAction,
  primaryLabel: string,
  secondary: DominantAction | null,
  secondaryLabel: string | null,
  confidence: number,
  cssClass: string
): DominantActionResult {
  return {
    primaryAction: primary,
    primaryLabel,
    secondaryAction: secondary,
    secondaryLabel,
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    cssClass
  };
}
