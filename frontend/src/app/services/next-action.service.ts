import { Injectable } from '@angular/core';
import { SetupCandidate } from '../models/execution.model';
import { ProbabilisticExecutionSnapshot } from '../models/probabilistic.model';
import { TriggerLine } from './trigger-line-overlay.service';

export type ActionTone = 'wait' | 'enter' | 'exit' | 'partials' | 'hold' | 'add';

export interface NextAction {
  verb: string;
  trigger: string;
  risk: string;
  tone: ActionTone;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  line: string;
  /** @deprecated */
  title: string;
  condition: string;
  why: string;
  action: string;
  blockers: string[];
  triggerPrice: number | null;
}

const MAX_LEN = 70;

@Injectable({ providedIn: 'root' })
export class NextActionService {
  resolve(
    source: SetupCandidate | null,
    probabilistic: ProbabilisticExecutionSnapshot | null,
    trigger: TriggerLine | null,
    marketChoppy: boolean,
    noEdge: boolean
  ): NextAction {
    const exit = probabilistic?.adaptiveExit?.state;
    const fail = probabilistic?.failureSignature?.failureProbability ?? 0;
    const trust = probabilistic?.marketTrust?.score ?? 50;
    const theta = probabilistic?.optionsExecution?.thetaRisk;

    if (exit === 'EXIT_NOW' || fail >= 45) {
      return this.build('EXIT NOW', 'breakdown risk increasing', 'honor stop', 'exit', 'CRITICAL');
    }

    if (exit === 'SCALE_PARTIAL' || exit === 'TAKE_PROFIT') {
      return this.build('PARTIALS', 'expected move nearly complete', 'protect gains', 'partials', 'HIGH');
    }

    if (trigger?.active && source?.freshness === 'FRESH') {
      return this.build('ENTER LIGHT', 'momentum improving', marketChoppy ? 'weak regime' : 'respect stop', 'enter', 'HIGH');
    }

    if (trigger && !trigger.active) {
      const trig = trigger.kind === 'RECLAIM'
        ? 'reclaim VWAP first'
        : `> ${trigger.price.toFixed(2)}`;
      const risk = theta === 'HIGH' || theta === 'EXTREME' ? 'theta decay risk'
        : marketChoppy ? 'weak regime' : 'need RVOL';
      const verb = trigger.kind === 'BREAKOUT' ? `ADD ${trigger.price.toFixed(2)}` : 'WAIT';
      const tone: ActionTone = trigger.kind === 'BREAKOUT' ? 'add' : 'wait';
      return this.build(verb, trig, risk, tone, 'MEDIUM', trigger.price);
    }

    if (noEdge || marketChoppy || trust < 40) {
      return this.build('WAIT', 'no expansion yet', theta === 'HIGH' ? 'theta decay risk' : 'stay patient', 'wait', 'LOW');
    }

    if (exit === 'HOLD' || trigger?.active) {
      return this.build('HOLD', 'structure holding', 'watch invalidation', 'hold', 'MEDIUM');
    }

    return this.build('WAIT', 'await trigger', 'no urgency', 'wait', 'LOW');
  }

  private build(
    verb: string,
    trigger: string,
    risk: string,
    tone: ActionTone,
    urgency: NextAction['urgency'],
    triggerPrice: number | null = null
  ): NextAction {
    const line = this.clip(`${verb} → ${trigger} → ${risk}`);
    return {
      verb,
      trigger,
      risk,
      tone,
      urgency,
      line,
      title: verb,
      condition: trigger,
      why: trigger,
      action: trigger,
      blockers: risk ? [risk] : [],
      triggerPrice
    };
  }

  private clip(s: string): string {
    return s.length <= MAX_LEN ? s : s.slice(0, MAX_LEN - 1) + '…';
  }
}
