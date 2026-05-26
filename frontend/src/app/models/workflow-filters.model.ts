export interface WorkflowFilters {
  bullishOnly: boolean;
  bearishOnly: boolean;
  freshOnly: boolean;
  highRvolOnly: boolean;
  mtfAlignedOnly: boolean;
  earlyExpansionOnly: boolean;
  persistenceOnly: boolean;
  healthyPullbackOnly: boolean;
  vwapAcceptanceOnly: boolean;
  compressionReadyOnly: boolean;
  highVelocityOnly: boolean;
  confirmedOnly: boolean;
  developingOnly: boolean;
  exhaustionRiskOnly: boolean;
  failedExpansionOnly: boolean;
  regimeTransitionOnly: boolean;
}

export const DEFAULT_WORKFLOW_FILTERS: WorkflowFilters = {
  bullishOnly: false,
  bearishOnly: false,
  freshOnly: false,
  highRvolOnly: false,
  mtfAlignedOnly: false,
  earlyExpansionOnly: false,
  persistenceOnly: false,
  healthyPullbackOnly: false,
  vwapAcceptanceOnly: false,
  compressionReadyOnly: false,
  highVelocityOnly: false,
  confirmedOnly: false,
  developingOnly: false,
  exhaustionRiskOnly: false,
  failedExpansionOnly: false,
  regimeTransitionOnly: false
};

export type WorkflowFilterKey = keyof WorkflowFilters;

/** Migrate legacy filter keys from localStorage (Phase 168). */
export function migrateLegacyWorkflowFilters(raw: Record<string, boolean>): WorkflowFilters {
  const next = { ...DEFAULT_WORKFLOW_FILTERS };
  if (raw['freshOnly']) next.freshOnly = true;
  if (raw['highRvolOnly']) next.highRvolOnly = true;
  if (raw['mtfAlignedOnly']) next.mtfAlignedOnly = true;
  if (raw['bullishOnly']) next.bullishOnly = true;
  if (raw['bearishOnly']) next.bearishOnly = true;
  if (raw['openMomOnly']) next.earlyExpansionOnly = true;
  if (raw['contOnly']) next.persistenceOnly = true;
  if (raw['openFailOnly']) next.failedExpansionOnly = true;
  if (raw['topRankOnly']) next.confirmedOnly = true;
  for (const key of Object.keys(DEFAULT_WORKFLOW_FILTERS) as WorkflowFilterKey[]) {
    if (raw[key] === true) next[key] = true;
  }
  return next;
}
