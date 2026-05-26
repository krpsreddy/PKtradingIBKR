import { CognitionChipTone } from './cognition-chips.util';

const ICONS: Record<string, string> = {
  FRESH: '✦',
  EXTENDED: '⚠',
  CHASING: '⌛',
  EARLY: '✦',
  FAIL: '💀',
  RR: '🎯',
  HALF: '⏳',
  RVOL: '🔥',
  MACD: '⚠',
  VWAP: '⚠',
  IV: '⚡',
  THETA: '⏳',
  MOMENTUM: '📈',
  LATE: '⌛'
};

export function chipIcon(label: string): string {
  const u = label.toUpperCase();
  for (const [key, icon] of Object.entries(ICONS)) {
    if (u.includes(key)) return icon;
  }
  if (u.includes('WEAK') || u.includes('RISK')) return '⚠';
  return '•';
}

export function optionsIcon(field: string): string {
  switch (field) {
    case 'strike': return '🎯';
    case 'premium': return '⚡';
    case 'theta': return '⏳';
    case 'iv': return '🔥';
    case 'hold': return '⌛';
    default: return '•';
  }
}

export function thetaClass(level: string | null | undefined): CognitionChipTone {
  if (!level) return 'neutral';
  if (level === 'LOW') return 'positive';
  if (level === 'MODERATE') return 'neutral';
  return 'risk';
}

export function ivClass(profile: string | null | undefined): CognitionChipTone {
  if (profile === 'EXPANDING') return 'positive';
  if (profile === 'CRUSH_RISK') return 'risk';
  return 'neutral';
}
