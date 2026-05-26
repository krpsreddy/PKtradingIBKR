/** Progressive fade for stale / low-priority information — with readability floors. */
import { clampOpacity, OPACITY_FLOOR } from './readability-floors.util';

export function rowDecayOpacity(rankIndex: number, stale: boolean): number {
  let o = rankIndex === 0 ? 1 : rankIndex === 1 ? 0.82 : rankIndex === 2 ? 0.65 : 0.45;
  if (stale) o *= 0.72;
  return rankIndex === 0 || stale === false && rankIndex <= 1
    ? clampOpacity(o, rankIndex === 0 ? 'secondary' : 'peripheral')
    : Math.max(OPACITY_FLOOR.sidebarInactive, o);
}

export function cognitionDecayOpacity(pillIndex: number, urgency: boolean): number {
  if (!urgency) return OPACITY_FLOOR.peripheral;
  return pillIndex === 0 ? OPACITY_FLOOR.critical : pillIndex === 1 ? OPACITY_FLOOR.secondary : OPACITY_FLOOR.peripheral;
}

export function triggerDecayOpacity(staleTrigger: boolean, nearTrigger: boolean): number {
  if (staleTrigger && !nearTrigger) return clampOpacity(0.55, 'peripheral');
  if (nearTrigger) return clampOpacity(0.92, 'critical');
  return clampOpacity(0.72, 'secondary');
}

export function urgencyDissolveMinutes(ageMinutes: number | null): number {
  if (ageMinutes == null) return 1;
  if (ageMinutes <= 15) return 1;
  if (ageMinutes <= 30) return 0.75;
  if (ageMinutes <= 60) return 0.5;
  return 0.32;
}
