import { NumericThresholdCheck } from '../explainable-regime.models';
import { EngineeringTriggerLine } from './explainability-layer.models';

export function fromNumericCheck(c: NumericThresholdCheck): EngineeringTriggerLine {
  const label = formatFeatureLabel(c.feature);
  return {
    label,
    actual: c.actual,
    operator: c.operator,
    threshold: c.threshold,
    passed: c.passed,
    engineeringKey: c.feature
  };
}

export function engineeringLine(
  label: string,
  actual: number | string,
  operator: string,
  threshold: number | string,
  passed: boolean,
  key?: string
): EngineeringTriggerLine {
  return { label, actual, operator, threshold, passed, engineeringKey: key };
}

export function formatTriggerDisplay(line: EngineeringTriggerLine): string {
  const mark = line.passed ? '✓' : '✗';
  return `${line.label}: ${line.actual} ${line.operator} ${line.threshold} ${mark}`;
}

export function dedupeTriggers(lines: EngineeringTriggerLine[]): EngineeringTriggerLine[] {
  const seen = new Set<string>();
  const out: EngineeringTriggerLine[] = [];
  for (const l of lines) {
    const k = l.engineeringKey ?? l.label;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

function formatFeatureLabel(feature: string): string {
  return feature
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
