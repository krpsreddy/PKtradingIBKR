export type SignalHealthState =
  | 'BUILDING'
  | 'STRONG'
  | 'PEAKING'
  | 'WEAKENING'
  | 'FAILING';

export interface SignalHealthInfo {
  state: SignalHealthState;
  label: string;
  cssClass: string;
}

export const SIGNAL_HEALTH_META: Record<SignalHealthState, { label: string; cssClass: string }> = {
  BUILDING: { label: 'Building', cssClass: 'health-building' },
  STRONG: { label: 'Strong', cssClass: 'health-strong' },
  PEAKING: { label: 'Peaking', cssClass: 'health-peaking' },
  WEAKENING: { label: 'Weakening', cssClass: 'health-weakening' },
  FAILING: { label: 'Failing', cssClass: 'health-failing' }
};
