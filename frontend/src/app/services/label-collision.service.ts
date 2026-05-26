import { Injectable } from '@angular/core';
import { ChartExecutionLevel } from '../models/execution.model';
import { clampOpacity } from '../utils/readability-floors.util';

export interface LabelLayout {
  price: number;
  label: string;
  shortLabel: string;
  fullLabel: string;
  color: string;
  priority: number;
  offsetPx: number;
  opacity: number;
  merged: boolean;
  zoneGroup?: 'long' | 'risk';
}

const PRIORITY: Record<string, number> = {
  Stop: 0, Invalid: 1, Entry: 2, 'Entry+': 2, Target: 3, Trigger: 4, Prev: 5, VWAP: 6
};

const ZONE_LABELS: Record<string, { short: string; full: string }> = {
  long: { short: 'LONG ZONE', full: 'Long zone' },
  risk: { short: 'RISK ZONE', full: 'Risk zone' }
};

@Injectable({ providedIn: 'root' })
export class LabelCollisionService {
  layout(levels: ChartExecutionLevel[], triggerPrice: number | null, triggerLabel: string | null): LabelLayout[] {
    const raw: LabelLayout[] = levels.map(l => ({
      price: l.price,
      label: l.label,
      shortLabel: zoneShort(l.label),
      fullLabel: fullLabel(l.label, l.price),
      color: l.color,
      priority: PRIORITY[l.label] ?? 9,
      offsetPx: 0,
      opacity: 1,
      merged: false
    }));

    if (triggerPrice != null && triggerLabel) {
      raw.push({
        price: triggerPrice,
        label: 'Trigger',
        shortLabel: 'TRG',
        fullLabel: triggerLabel,
        color: '#d2aa5a',
        priority: PRIORITY['Trigger'],
        offsetPx: 0,
        opacity: 1,
        merged: false
      });
    }

    this.mergeZones(raw, 'Entry', 'Entry+', 'long');
    this.mergeZones(raw, 'Stop', 'Invalid', 'risk');
    raw.sort((a, b) => a.priority - b.priority || a.price - b.price);

    const minGapSteps = 22;
    let lane = 0;
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const tier = item.priority <= 1 ? 'critical' : item.priority <= 3 ? 'secondary' : 'peripheral';
      item.opacity = clampOpacity(1, tier);
      if (i > 0) {
        const prev = raw[i - 1];
        const pct = Math.abs(item.price - prev.price) / Math.max(item.price, 1);
        if (pct < 0.002) {
          lane += 1;
          item.offsetPx = lane * minGapSteps;
          if (item.priority > prev.priority) {
            item.opacity = clampOpacity(0.72, 'secondary');
          }
        }
      }
    }
    return raw.filter(l => !l.merged);
  }

  private mergeZones(
    items: LabelLayout[],
    primary: string,
    secondary: string,
    group: 'long' | 'risk'
  ): void {
    const threshold = 0.0035;
    const parent = items.find(x => x.label === primary && !x.merged);
    const child = items.find(x => x.label === secondary && !x.merged);
    if (!parent || !child) return;
    const pct = Math.abs(parent.price - child.price) / Math.max(parent.price, 1);
    if (pct >= threshold) return;

    const zone = ZONE_LABELS[group];
    parent.zoneGroup = group;
    parent.shortLabel = zone.short;
    parent.fullLabel = `${zone.full}: ${parent.fullLabel} / ${child.fullLabel}`;
    parent.price = (parent.price + child.price) / 2;
    parent.color = group === 'long' ? '#3fb950' : '#ff7b72';
    child.merged = true;
  }
}

function zoneShort(label: string): string {
  switch (label) {
    case 'Entry': return 'ENTRY';
    case 'Entry+': return 'ENTRY+';
    case 'Stop': return 'STOP';
    case 'Invalid': return 'INV';
    case 'Target': return 'TGT';
    case 'Prev': return 'PREV';
    default: return label.toUpperCase();
  }
}

function fullLabel(label: string, price: number): string {
  const p = price.toFixed(2);
  switch (label) {
    case 'Entry': return `Entry $${p}`;
    case 'Entry+': return `Entry+ $${p}`;
    case 'Stop': return `Stop $${p}`;
    case 'Invalid': return `Invalid $${p}`;
    case 'Target': return `Target $${p}`;
    case 'Prev': return `Prev close $${p}`;
    default: return `${label} $${p}`;
  }
}
