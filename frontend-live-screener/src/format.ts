/** Normalize API fields that may be string or { label, description }. */
export function textLine(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null) {
    const o = value as { label?: string; description?: string };
    if (o.label && o.description) return `${o.label} — ${o.description}`;
    if (o.label) return o.label;
    if (o.description) return o.description;
  }
  return '—';
}

export function whyNowText(items: unknown[] | undefined): string {
  if (!items?.length) return '—';
  return items.map(textLine).filter(s => s !== '—').join(' · ') || '—';
}
