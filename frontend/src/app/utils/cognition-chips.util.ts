export type CognitionChipTone = 'positive' | 'risk' | 'neutral';

export interface CognitionChip {
  label: string;
  tone: CognitionChipTone;
  title?: string;
}

export function reasonToChip(reason: string): CognitionChip {
  const r = reason.toUpperCase();
  if (r.includes('RVOL') || r.includes('VOLUME')) {
    return { label: r.includes('WEAK') ? 'RVOL WEAK' : 'HIGH RVOL', tone: r.includes('WEAK') ? 'risk' : 'positive' };
  }
  if (r.includes('VWAP')) return { label: r.includes('WEAK') || r.includes('FAIL') ? 'VWAP WEAK' : 'VWAP HOLD', tone: r.includes('WEAK') ? 'risk' : 'positive' };
  if (r.includes('MACD') || r.includes('FLAT')) return { label: 'MACD FLAT', tone: 'risk' };
  if (r.includes('LOW HIGH') || r.includes('LOWER')) return { label: 'LOWER HIGHS', tone: 'risk' };
  if (r.includes('INVALID')) return { label: 'INVALID', tone: 'risk' };
  if (r.includes('WEAK')) return { label: r.slice(0, 14), tone: 'risk' };
  return { label: reason.slice(0, 16).toUpperCase(), tone: 'neutral', title: reason };
}

export function buildCognitionChips(input: {
  entryQuality?: string | null;
  extended?: boolean;
  freshness?: string | null;
  relativeVolume?: number | null;
  failurePct?: number | null;
  rr?: number | null;
  halfLifeMin?: number | null;
  maturity?: string | null;
  deteriorationReasons?: string[];
  warnings?: string[];
}): CognitionChip[] {
  const chips: CognitionChip[] = [];

  if (input.freshness === 'FRESH') chips.push({ label: 'FRESH', tone: 'positive' });
  if (input.extended) chips.push({ label: 'EXTENDED', tone: 'risk' });
  if (input.entryQuality === 'CHASING') chips.push({ label: 'CHASING', tone: 'risk' });
  if (input.entryQuality === 'EARLY') chips.push({ label: 'EARLY', tone: 'positive' });
  if (input.relativeVolume != null && input.relativeVolume >= 2) {
    chips.push({ label: `RVOL ${input.relativeVolume.toFixed(1)}x`, tone: 'positive' });
  }
  if (input.failurePct != null && input.failurePct >= 20) {
    chips.push({ label: `FAIL ${Math.round(input.failurePct)}%`, tone: input.failurePct >= 45 ? 'risk' : 'neutral' });
  }
  if (input.rr != null) chips.push({ label: `RR ${input.rr}`, tone: input.rr >= 2 ? 'positive' : 'neutral' });
  if (input.halfLifeMin != null) chips.push({ label: `HALF ${input.halfLifeMin}m`, tone: 'neutral' });
  if (input.maturity) chips.push({ label: input.maturity, tone: input.maturity.includes('FAIL') || input.maturity.includes('WEAK') ? 'risk' : 'positive' });

  for (const r of input.deteriorationReasons ?? []) {
    const c = reasonToChip(r);
    if (!chips.some(x => x.label === c.label)) chips.push(c);
  }
  for (const w of input.warnings ?? []) {
    const c = reasonToChip(w);
    if (!chips.some(x => x.label === c.label)) chips.push(c);
  }

  return chips.slice(0, 10);
}
