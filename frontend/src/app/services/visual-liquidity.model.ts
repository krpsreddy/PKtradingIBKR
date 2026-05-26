import { Injectable } from '@angular/core';

export interface LiquidityInput {
  rvol: number;
  rangeContracted: boolean;
  velocity: number;
  rejectionFrequency: number;
  candleOverlap: boolean;
}

export interface LiquiditySnapshot {
  liquidityDensity: number;
  expansionProbability: number;
  liveCandleBoost: number;
  volumeOpacity: number;
  corridorSharpness: number;
  triggerClarity: number;
}

@Injectable({ providedIn: 'root' })
export class VisualLiquidityModel {
  resolve(input: LiquidityInput): LiquiditySnapshot {
    let density = 0.35;
    if (input.rvol >= 4) density += 0.35;
    else if (input.rvol >= 2.5) density += 0.22;
    else if (input.rvol >= 1.5) density += 0.1;
    else density -= 0.12;

    if (input.rangeContracted) density += 0.12;
    if (input.candleOverlap) density += 0.08;
    density -= Math.min(0.25, input.rejectionFrequency * 0.004);

    density = Math.max(0.15, Math.min(0.95, density));

    const expansion = Math.max(0.1, Math.min(0.92,
      input.velocity * 0.006 + density * 0.35 + (input.rvol >= 2 ? 0.15 : 0)));

    return {
      liquidityDensity: density,
      expansionProbability: expansion,
      liveCandleBoost: 0.45 + density * 0.42 + expansion * 0.18,
      volumeOpacity: 0.18 + density * 0.38,
      corridorSharpness: 0.35 + density * 0.45 + expansion * 0.12,
      triggerClarity: 0.32 + expansion * 0.48 + density * 0.22
    };
  }
}
