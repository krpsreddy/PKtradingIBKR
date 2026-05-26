import { Injectable } from '@angular/core';
import { ReplaySignalJumpKind } from './replay-workstation.models';

@Injectable({ providedIn: 'root' })
export class ReplayInteractionFeedbackEngine {
  jumpLabel(kind: ReplaySignalJumpKind): string {
    switch (kind) {
      case 'NEXT_ENTRY': return 'next entry';
      case 'PREV_ENTRY': return 'previous entry';
      case 'NEXT_TRAP': return 'next trap';
      case 'NEXT_RECLAIM': return 'reclaim entry';
      case 'NEXT_SECOND_LEG': return 'second leg';
      case 'NEXT_SIGNAL': return 'next signal';
      case 'PREV_SIGNAL': return 'previous signal';
      default: return 'signal';
    }
  }

  isStale(feedbackStartedAt: number, maxAgeMs = 4000): boolean {
    return Date.now() - feedbackStartedAt > maxAgeMs;
  }
}
