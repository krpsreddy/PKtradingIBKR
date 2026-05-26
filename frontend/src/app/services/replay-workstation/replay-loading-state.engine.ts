import { Injectable } from '@angular/core';
import { ReplayActionFeedback, ReplayUxStatus } from './replay-ux.models';

@Injectable({ providedIn: 'root' })
export class ReplayLoadingStateEngine {
  statusForLoading(loading: boolean, playing: boolean, reviewMode: boolean): ReplayUxStatus {
    if (loading) return 'LOADING_SESSION';
    if (reviewMode) return 'REVIEW_MODE';
    if (playing) return 'PLAYING';
    return 'PAUSED';
  }

  feedbackForAction(kind: ReplayActionFeedback['kind'], detail?: string): ReplayActionFeedback {
    const messages: Record<ReplayActionFeedback['kind'], string> = {
      loading: detail ?? 'Loading replay…',
      snap: detail ?? 'Snapping to signal…',
      session: detail ?? 'Loading session…',
      symbol: detail ?? 'Switching symbol…',
      jump: detail ?? 'Jumping to signal…'
    };
    return { message: messages[kind], startedAt: Date.now(), kind };
  }

  sessionLoadMessage(symbol: string, sessionDate: string): ReplayActionFeedback {
    return this.feedbackForAction('session', `Loading session ${sessionDate} · ${symbol}…`);
  }

  snapMessage(label: string): ReplayActionFeedback {
    return this.feedbackForAction('snap', `Snapping to ${label}…`);
  }
}
