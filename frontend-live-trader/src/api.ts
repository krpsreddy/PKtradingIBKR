import type { QuoteBatch } from './services/live-quote-feed/quote-stream.models';
import type { LiveTraderSnapshot, RuntimeControls, Tier1Snapshot } from './types';

const API = '/api/live-trader';

export async function fetchTier1(): Promise<Tier1Snapshot> {
  const r = await fetch(`${API}/tier1`);
  if (!r.ok) throw new Error('tier1 failed');
  return r.json();
}

export async function fetchSnapshot(): Promise<LiveTraderSnapshot> {
  const r = await fetch(`${API}/snapshot`);
  if (!r.ok) throw new Error('snapshot failed');
  return r.json();
}

export async function fetchRuntime(): Promise<RuntimeControls> {
  const r = await fetch(`${API}/runtime`);
  if (!r.ok) throw new Error('runtime failed');
  return r.json();
}

export async function putRuntime(patch: Partial<RuntimeControls>): Promise<RuntimeControls> {
  const r = await fetch(`${API}/runtime`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scanningEnabled: patch.scanningEnabled,
      telegramEnabled: patch.telegramEnabled,
      autoExecutionEnabled: patch.autoExecutionEnabled,
      executionMode: patch.executionMode
    })
  });
  if (!r.ok) throw new Error('runtime update failed');
  return r.json();
}

export async function fetchQuotes(symbols: string[]): Promise<QuoteBatch> {
  if (!symbols.length) return {};
  const q = encodeURIComponent(symbols.join(','));
  const r = await fetch(`/api/quotes?symbols=${q}`);
  if (!r.ok) throw new Error('quotes failed');
  return r.json();
}

export async function setPaperMode(mode: 'OFF' | 'PAPER_RESEARCH'): Promise<void> {
  await fetch('/api/paper-execution/mode', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
}
