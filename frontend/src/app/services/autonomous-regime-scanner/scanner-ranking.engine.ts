import { ExecutionCardDto } from '../intelligence-offload/intelligence-snapshot-api.service';
import {
  AutonomousOpportunityType,
  AutonomousTraderAction,
  ScannerCardTone,
  ScannerOpportunityCard,
  ScannerSectionId
} from './autonomous-regime-scanner.models';

export interface ScannerRankInput {
  symbol: string;
  card?: ExecutionCardDto;
  regimeType?: string;
  classification?: string;
  continuationPersistence?: number;
  expansionProbability?: number;
  shallowPullbackQuality?: number;
  exhaustionProbability?: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function mapToOpportunityType(entryType: string, action: string, classification?: string): AutonomousOpportunityType {
  const e = entryType.toUpperCase();
  const a = action.toUpperCase();
  const c = (classification ?? '').toUpperCase();
  if (a.includes('EXHAUSTION') || e.includes('EXHAUSTION') || c.includes('EXHAUSTION')) return 'LATE_STAGE_EXHAUSTION';
  if (e.includes('SHALLOW') || c.includes('PULLBACK')) return 'SHALLOW_PULLBACK_CONTINUATION';
  if (e.includes('VWAP')) return 'VWAP_PERSISTENCE';
  if (e.includes('COMPRESSION') || e.includes('MICRO')) return 'COMPRESSION_RELEASE';
  if (e.includes('ORB') || e.includes('ACCELERATION') || c.includes('ACCELERATION')) return 'INSTITUTIONAL_ACCELERATION';
  if (e.includes('RESUMPTION')) return 'TREND_RESUMPTION';
  return 'EARLY_CONTINUATION';
}

export function mapTraderAction(type: AutonomousOpportunityType, card?: ExecutionCardDto): AutonomousTraderAction {
  if (type === 'LATE_STAGE_EXHAUSTION') return 'AVOID';
  const a = (card?.action ?? '').toUpperCase();
  if (a.includes('ADD')) return 'ADD';
  if (a.includes('EXHAUSTION') || a.includes('CHASE')) return 'AVOID';
  if (a.includes('WAIT') || a.includes('WATCH')) return 'WATCH';
  return 'ENTER';
}

export function toneForType(type: AutonomousOpportunityType): ScannerCardTone {
  switch (type) {
    case 'LATE_STAGE_EXHAUSTION': return 'RED';
    case 'TREND_RESUMPTION': return 'ORANGE';
    case 'SHALLOW_PULLBACK_CONTINUATION': return 'YELLOW';
    default: return 'GREEN';
  }
}

export function badgeForType(type: AutonomousOpportunityType): string {
  switch (type) {
    case 'EARLY_CONTINUATION': return '🟢 HIGH CONTINUATION';
    case 'SHALLOW_PULLBACK_CONTINUATION': return '🟡 HEALTHY PULLBACK';
    case 'VWAP_PERSISTENCE': return '🟢 VWAP PERSISTENCE';
    case 'INSTITUTIONAL_ACCELERATION': return '🟢 INSTITUTIONAL PERSISTENCE';
    case 'COMPRESSION_RELEASE': return '🟢 COMPRESSION BREAKOUT';
    case 'TREND_RESUMPTION': return '🟠 LATE EXTENSION';
    case 'LATE_STAGE_EXHAUSTION': return '🔴 EXHAUSTION DEVELOPING';
  }
}

export function sectionForType(type: AutonomousOpportunityType): ScannerSectionId {
  switch (type) {
    case 'EARLY_CONTINUATION': return 'HIGH_CONTINUATION';
    case 'INSTITUTIONAL_ACCELERATION': return 'INSTITUTIONAL_PERSISTENCE';
    case 'SHALLOW_PULLBACK_CONTINUATION': return 'HEALTHY_PULLBACK';
    case 'COMPRESSION_RELEASE': return 'COMPRESSION_BREAKOUT';
    case 'LATE_STAGE_EXHAUSTION': return 'EXHAUSTION_AVOID';
    default: return 'EARLY_EXPANSION';
  }
}

export function integrityScore(card?: ExecutionCardDto): number {
  if (!card) return 50;
  const label = (card.continuationIntegrity ?? '').toUpperCase();
  if (label.includes('HIGH') || label.includes('STRONG')) return 88;
  if (label.includes('MODERATE') || label.includes('MEDIUM')) return 68;
  if (label.includes('LOW') || label.includes('WEAK')) return 42;
  return 62;
}

export function institutionalPressure(card?: ExecutionCardDto, regimeType?: string): number {
  const r = (regimeType ?? card?.entryType ?? '').toUpperCase();
  if (r.includes('INSTITUTIONAL') || r.includes('ORB')) return 85;
  if (r.includes('ACCELERATION')) return 78;
  return 58;
}

export function buildScannerCard(input: ScannerRankInput, rank: number): ScannerOpportunityCard {
  const card = input.card;
  const type = mapToOpportunityType(card?.entryType ?? input.regimeType ?? '', card?.action ?? '', input.classification);
  const expansion = card?.expansionProbability ?? input.expansionProbability ?? 50;
  const persistence = input.continuationPersistence ?? Math.round(expansion * 0.85);
  const exhaustion = input.exhaustionProbability ?? clamp(100 - expansion - persistence * 0.15);
  const triggerIntegrity = integrityScore(card);
  const institutional = institutionalPressure(card, input.regimeType);
  const executionQuality = clamp(Math.round(expansion * 0.35 + triggerIntegrity * 0.35 + persistence * 0.3));

  const whyNow: string[] = [];
  if (card?.rvolLabel) whyNow.push(`RVOL ${card.rvolLabel}`);
  if (card?.vwapPersistenceLabel) whyNow.push(`VWAP ${card.vwapPersistenceLabel.toLowerCase()}`);
  if (card?.shallowPbQuality) whyNow.push(`shallow PB ${card.shallowPbQuality.toLowerCase()}`);
  if (triggerIntegrity >= 70) whyNow.push('continuation integrity HIGH');
  if (exhaustion >= 55) whyNow.push('exhaustion drift detected');
  if (!whyNow.length && card?.triggerReason) whyNow.push(card.triggerReason);

  return {
    symbol: input.symbol,
    opportunityType: type,
    action: mapTraderAction(type, card),
    tone: toneForType(type),
    badge: badgeForType(type),
    convictionScore: 0,
    expansionProbability: expansion,
    continuationPersistence: persistence,
    triggerIntegrity,
    institutionalPressure: institutional,
    exhaustionProbability: exhaustion,
    executionQuality,
    entryZoneLabel: '—',
    riskLabel: card?.continuationRisk ?? (type === 'LATE_STAGE_EXHAUSTION' ? 'HIGH' : 'LOW'),
    whyNow: whyNow.slice(0, 4),
    windowLabel: card?.windowLabel ?? '—',
    rvolLabel: card?.rvolLabel ?? '—',
    popVelocity: 0,
    isRising: false,
    rank
  };
}

export function formatAutonomousLabel(type: AutonomousOpportunityType): string {
  return type.replace(/_/g, ' ');
}

export function formatReplayEventLabel(eventType: string): string {
  const e = eventType.toUpperCase();
  if (e.includes('CONTINUATION') && e.includes('ENTRY')) return 'CONTINUATION ENTRY';
  if (e.includes('SHALLOW') || e.includes('PULLBACK')) return 'SHALLOW PB HOLD';
  if (e.includes('COMPRESSION')) return 'COMPRESSION BREAKOUT';
  if (e.includes('ADD')) return 'PERSISTENCE ADD';
  if (e.includes('EXHAUSTION')) return 'EXHAUSTION WARNING';
  if (e.includes('VWAP')) return 'VWAP PERSISTENCE';
  return e.replace(/_/g, ' ');
}
