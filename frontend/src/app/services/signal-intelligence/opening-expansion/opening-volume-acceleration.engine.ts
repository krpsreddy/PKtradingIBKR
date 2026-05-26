import { OpeningExpansionInput } from './opening-expansion.models';

/** Opening RVOL stack and acceleration detection. */
export class OpeningVolumeAccelerationEngine {

  score(input: OpeningExpansionInput): number {
    const rvol = input.rvol ?? 0;
    if (rvol < 1.5) return 20;
    if (rvol < 2.5) return 45;
    if (rvol < 5) return 72;
    if (rvol < 8) return 85;
    return 55;
  }

  isAccelerating(input: OpeningExpansionInput): boolean {
    const rvol = input.rvol ?? 0;
    const ext = Math.abs(input.vwapDistance ?? 0) * 100;
    return rvol >= 2.5 && rvol <= 8 && !(input.extended && ext > 5);
  }
}
