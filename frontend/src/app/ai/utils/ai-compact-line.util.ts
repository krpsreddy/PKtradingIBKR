import { AiExecutionResponse } from '../models/ai.models';

export function formatAiCompactLine(response: AiExecutionResponse | null | undefined): string {
  if (!response?.compactLine?.trim()) {
    return buildCompactLine(response);
  }
  const line = response.compactLine.trim();
  return line.startsWith('AI') ? line : `AI · ${line}`;
}

function buildCompactLine(r: AiExecutionResponse | null | undefined): string {
  if (!r) return '';
  const quality = r.entryQuality;
  const fakeout = r.fakeoutProbability;
  const action = r.recommendedAction;

  if (quality && fakeout != null && fakeout <= 0.25) {
    return `AI · ${quality} ENTRY · LOW FAKEOUT RISK`;
  }
  if (action === 'WAIT' && r.suggestedEntry) {
    return `AI · WAIT FOR ${r.suggestedEntry.toUpperCase()}`;
  }
  if (action === 'WAIT') {
    return `AI · WAIT — ${r.summary?.slice(0, 48) ?? 'NO TRIGGER'}`;
  }
  if (fakeout != null && fakeout >= 0.45) {
    return 'AI · PREMARKET EXHAUSTION ELEVATED';
  }
  if (quality) return `AI · ${quality} ENTRY`;
  if (r.summary) return `AI · ${r.summary.slice(0, 56)}`;
  return '';
}
