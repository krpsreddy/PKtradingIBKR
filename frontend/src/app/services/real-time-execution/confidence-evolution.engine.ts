import { ConfidencePoint } from './real-time-execution.models';

/** Track conviction evolution slope over recent timeline. */
export function convictionVelocityFromTimeline(timeline: ConfidencePoint[]): number {
  if (timeline.length < 2) return 0;
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const dtSec = Math.max(1, (last.timestamp - first.timestamp) / 1000);
  return Math.round((last.conviction - first.conviction) / dtSec * 10);
}

export function formatConfidenceEvolution(timeline: ConfidencePoint[]): string {
  if (!timeline.length) return '—';
  return timeline.map(p => String(p.conviction)).join(' → ');
}
