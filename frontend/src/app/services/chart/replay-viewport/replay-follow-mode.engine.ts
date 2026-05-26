import { Injectable } from '@angular/core';
import { ReplayInteractionMode } from './replay-viewport.models';

@Injectable({ providedIn: 'root' })
export class ReplayFollowModeEngine {
  shouldAutoFollow(mode: ReplayInteractionMode): boolean {
    return mode === 'PLAYING' || mode === 'FOLLOWING_HEAD';
  }

  isViewportLocked(mode: ReplayInteractionMode): boolean {
    return mode === 'INSPECTING' || mode === 'PAUSED' || mode === 'DETACHED_VIEW';
  }

  allowsViewportMutation(mode: ReplayInteractionMode): boolean {
    return mode === 'PLAYING' || mode === 'FOLLOWING_HEAD';
  }

  resolveMode(playing: boolean, autoFollow: boolean, userDetached: boolean): ReplayInteractionMode {
    if (playing && autoFollow) return 'PLAYING';
    if (playing && !autoFollow) return 'DETACHED_VIEW';
    if (!playing && userDetached) return 'INSPECTING';
    return 'PAUSED';
  }
}
